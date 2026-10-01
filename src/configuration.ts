import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import JSON5 from "json5";
import { parse as parseTOML } from "smol-toml";
import YAML from "yaml";
import type { FormattingOptions } from "./core.ts";
import type {
  ImportCompareFunction,
  ImportElementCompareFunction,
  SeparateByFunction,
} from "./rules.ts";

/**
 * Options for configuring import formatting and sorting.
 *
 * An omitted field uses the corresponding value in {@link defaultConfig}; an
 * empty rule list disables that stage. See `examples/configs/` for config files
 * in each supported format.
 */
export interface Config {
  /**
   * Names of import comparators in priority order.
   *
   * Prefix a name with `!` to reverse that rule's result.
   */
  sortImports?: string[];
  /** Names of comparators for the elements within each import. */
  sortImportElements?: string[];
  /** Names of predicates that separate adjacent imports with a blank line. */
  separateBy?: string[];
  /** Overrides for rendered import declarations. */
  formatting?: FormattingOptions;
  /**
   * Paths to custom comparison or separation rules.
   *
   * Map each rule name to an ESM module path relative to the config file. Each
   * module must default-export an {@link ImportCompareFunction},
   * {@link ImportElementCompareFunction}, or {@link SeparateByFunction}.
   * TypeScript modules require a TS-aware runtime (Deno or supported Node).
   */
  require?: Record<string, string>;
}

/** A config with every optional field filled in from the defaults. */
export type FullConfig = Required<Config> & {
  formatting: Required<FormattingOptions>;
};
/**
 * Default configuration for formatting imports.
 *
 * Alphabetize named specifiers in Deno's style without reordering import
 * declarations or adding separator lines.
 */
export const defaultConfig: FullConfig = {
  sortImports: [],
  sortImportElements: ["specifierName"],
  separateBy: [],
  formatting: {
    indent: 2,
    bracketIndent: 1,
    quoteStyle: "double",
    maxColumns: 80,
    trailingComma: true,
    breakFrom: false,
  },
  require: {},
};

const configExtensions = [
  ".json",
  ".jsonc",
  ".json5",
  ".yaml",
  ".yml",
  ".toml",
] as const;

function validate(value: unknown): Config {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Config must be an object");
  }
  const config = value as Record<string, unknown>;
  for (const key of ["sortImports", "sortImportElements", "separateBy"]) {
    if (
      config[key] !== undefined &&
      (!Array.isArray(config[key]) ||
        !(config[key] as unknown[]).every((v) => typeof v === "string"))
    ) {
      throw new Error(`${key} must be an array of rule names`);
    }
  }
  if (
    config.require !== undefined &&
    (!config.require || typeof config.require !== "object" ||
      Array.isArray(config.require) ||
      !Object.values(config.require).every((v) => typeof v === "string"))
  ) throw new Error("require must map names to paths");
  if (config.formatting !== undefined) {
    const formatting = config.formatting;
    if (
      !formatting || typeof formatting !== "object" || Array.isArray(formatting)
    ) throw new Error("formatting must be an object");
    const fields = formatting as Record<string, unknown>;
    for (const key of ["indent", "bracketIndent", "maxColumns"]) {
      if (
        fields[key] !== undefined &&
        (typeof fields[key] !== "number" || !Number.isInteger(fields[key]) ||
          (fields[key] as number) < 0)
      ) {
        throw new Error(`formatting.${key} must be a nonnegative integer`);
      }
    }
    if (
      fields.quoteStyle !== undefined && fields.quoteStyle !== "single" &&
      fields.quoteStyle !== "double"
    ) throw new Error("Invalid quoteStyle");
    for (const key of ["trailingComma", "breakFrom"]) {
      if (fields[key] !== undefined && typeof fields[key] !== "boolean") {
        throw new Error(`formatting.${key} must be a boolean`);
      }
    }
  }
  return config as Config;
}

/** A loader for config files and their default values. */
export class ConfigHandler implements FullConfig {
  /** Import comparator names, in order of execution. */
  readonly sortImports: string[];
  /** Binding comparator names, in order of execution. */
  readonly sortImportElements: string[];
  /** Names of predicates for blank-line boundaries. */
  readonly separateBy: string[];
  /** Formatting options with all defaults resolved. */
  readonly formatting: Required<FormattingOptions>;
  /** ESM rule paths keyed by their configured names. */
  readonly require: Record<string, string>;

  /**
   * Load a config file and fill in missing options.
   *
   * Accept JSON, JSONC, JSON5, YAML (`.yml`/`.yaml`), or TOML. An explicit path
   * may have any basename, but must have a supported extension. Invalid syntax
   * or option types throw; rule names are checked when constructing an
   * `ImportSorter` or `ImportSeparator`.
   *
   * @param path Optional config file path; uses defaults when omitted.
   */
  constructor(path?: string) {
    let config: Config = {};
    if (path) {
      const content = readFileSync(path, "utf8");
      switch (extname(path).toLowerCase()) {
        case ".json":
          config = validate(JSON.parse(content));
          break;
        case ".json5":
        case ".jsonc":
          config = validate(JSON5.parse(content));
          break;
        case ".toml":
          config = validate(parseTOML(content));
          break;
        case ".yaml":
        case ".yml":
          config = validate(YAML.parse(content));
          break;
        default:
          throw new Error(`Unsupported config format: ${path}`);
      }
    }
    this.sortImports = config.sortImports ?? [...defaultConfig.sortImports];
    this.sortImportElements = config.sortImportElements ??
      [...defaultConfig.sortImportElements];
    this.separateBy = config.separateBy ?? [...defaultConfig.separateBy];
    this.formatting = { ...defaultConfig.formatting, ...config.formatting };
    this.require = { ...config.require };
  }

  /**
   * Check whether a path has a supported config file name.
   *
   * The basename must be `primp`, `pretty-ts-imports`, or `prettytsimports`, and
   * the extension must be supported. Both are checked case-insensitively.
   *
   * @param path Candidate config file path.
   * @returns Whether the name and extension are supported.
   */
  static isSupportedConfigFile(path: string): boolean {
    return ["primp", "pretty-ts-imports", "prettytsimports"].includes(
      basename(path, extname(path)).toLowerCase(),
    ) &&
      configExtensions.some((ext) => ext === extname(path).toLowerCase());
  }

  /**
   * Find a config file from an entry point.
   *
   * Search the entry point's directory and then walk up to the filesystem root.
   * A supported config file passed as the entry point is returned as-is. At
   * each directory, names are tried in the order above, then extensions in the
   * order JSON, JSONC, JSON5, YAML, YML, TOML. Use an explicit path to select
   * among multiple configs.
   *
   * @param entryPoint File or directory from which to search upwards.
   * @returns Path to the first matching config, if found.
   */
  static findConfig(entryPoint: string): string | undefined {
    let current = resolve(entryPoint);
    if (existsSync(current) && statSync(current).isFile()) {
      if (ConfigHandler.isSupportedConfigFile(current)) return current;
      current = dirname(current);
    }
    while (true) {
      if (existsSync(current)) {
        for (const name of ["primp", "pretty-ts-imports", "prettytsimports"]) {
          for (const ext of configExtensions) {
            const file = join(current, name + ext);
            if (existsSync(file) && statSync(file).isFile()) return file;
          }
        }
      }
      const parent = dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

/** A custom comparator or separator function loaded from a config file. */
export type RequiredFunction =
  | ImportCompareFunction
  | ImportElementCompareFunction
  | SeparateByFunction;

/**
 * Load custom rules from ESM modules.
 *
 * Paths resolve relative to `configPath`, not the current working directory.
 * The runtime handles `.ts` imports. The functions are keyed by rule name for
 * the sorter and separator.
 *
 * @param config Config containing the rule-name-to-path mapping.
 * @param configPath Config file path used to resolve relative module paths.
 * @returns Imported functions keyed by their configured names.
 * @throws When a path cannot be loaded, a module has no default function, or
 * `require` is configured without a config path.
 */
export async function loadRules(
  config: ConfigHandler,
  configPath?: string,
): Promise<Record<string, RequiredFunction>> {
  const rules: Record<string, RequiredFunction> = {};
  for (const [name, relativePath] of Object.entries(config.require)) {
    if (!configPath) throw new Error("Custom rules require a config file path");
    const url = pathToFileURL(resolve(dirname(configPath), relativePath)).href;
    const module: unknown = await import(url);
    const rule = (module as { default?: unknown }).default;
    if (typeof rule !== "function") {
      throw new Error(
        `Rule ${name} must have a default function export: ${url}`,
      );
    }
    rules[name] = rule as RequiredFunction;
  }
  return rules;
}
