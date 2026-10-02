import { existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { FormattingOptions } from "./core.ts";
import type {
  ImportCompareFunction,
  ImportElementCompareFunction,
  SeparateByFunction,
} from "./rules.ts";

/** A custom comparator or separator function. */
export type ConfigRule =
  | ImportCompareFunction
  | ImportElementCompareFunction
  | SeparateByFunction;

/** Options for formatting, sorting, and grouping imports. */
export interface Config {
  /** Include JavaScript files when scanning directories. */
  includeJs?: boolean;
  /** Import comparators in priority order; prefix a name with `!` to reverse it. */
  sortImports?: string[];
  /** Comparators for elements within each import. */
  sortImportElements?: string[];
  /** Predicates that separate adjacent imports with a blank line. */
  separateBy?: string[];
  /** Overrides for rendered import declarations. */
  formatting?: FormattingOptions;
  /** Named custom rules, including overrides for built-in rules. */
  rules?: Record<string, ConfigRule>;
}

/** Provide type checking and editor completion for a config's default export. */
export function defineConfig(config: Config): Config {
  return config;
}

/** A config with every optional field filled in from the defaults. */
export type FullConfig = Required<Config> & {
  formatting: Required<FormattingOptions>;
};

/** Default import ordering, grouping, and Deno-compatible formatting. */
export const defaultConfig: FullConfig = {
  includeJs: false,
  sortImports: [
    "!sideEffect",
    "sourceType",
    "!namespacePresence",
    "pathName",
    "sourceName",
  ],
  sortImportElements: ["specifierName"],
  separateBy: [
    "unequalSideEffectUse",
    "unequalPackageState",
    "unequalNamespaceUse",
  ],
  formatting: {
    indent: 2,
    bracketIndent: 1,
    quoteStyle: "double",
    maxColumns: 80,
    trailingComma: true,
    breakFrom: false,
  },
  rules: {},
};

/** Resolve defaults and discover TypeScript config files. */
export class ConfigHandler implements FullConfig {
  readonly includeJs: boolean;
  readonly sortImports: string[];
  readonly sortImportElements: string[];
  readonly separateBy: string[];
  readonly formatting: Required<FormattingOptions>;
  readonly rules: Record<string, ConfigRule>;

  /** Fill in omitted fields from the defaults. */
  constructor(config: Config = {}) {
    this.includeJs = config.includeJs ?? defaultConfig.includeJs;
    this.sortImports = config.sortImports ?? [...defaultConfig.sortImports];
    this.sortImportElements = config.sortImportElements ??
      [...defaultConfig.sortImportElements];
    this.separateBy = config.separateBy ?? [...defaultConfig.separateBy];
    this.formatting = { ...defaultConfig.formatting, ...config.formatting };
    this.rules = { ...config.rules };
  }

  /** Import a config module. The runtime must support TypeScript modules. */
  static async load(path?: string): Promise<ConfigHandler> {
    if (!path) return new ConfigHandler();
    if (extname(path).toLowerCase() !== ".ts") {
      throw new Error(`Unsupported config format: ${path}`);
    }
    const url = pathToFileURL(resolve(path)).href;
    const module: { default?: unknown } = await import(url);
    const value = module.default;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Config must default-export an object: ${path}`);
    }
    return new ConfigHandler(value as Config);
  }

  /** Check whether a path is a recognized config file name. */
  static isSupportedConfigFile(path: string): boolean {
    return extname(path).toLowerCase() === ".ts" &&
      ["primp.config", "pretty-ts-imports.config", "prettytsimports.config"]
        .includes(basename(path, extname(path)).toLowerCase());
  }

  /** Search from a file or directory upward for a config file. */
  static findConfig(entryPoint: string): string | undefined {
    let current = resolve(entryPoint);
    if (existsSync(current) && statSync(current).isFile()) {
      if (ConfigHandler.isSupportedConfigFile(current)) return current;
      current = dirname(current);
    }
    while (true) {
      if (existsSync(current)) {
        for (
          const name of [
            "primp.config.ts",
            "pretty-ts-imports.config.ts",
            "prettytsimports.config.ts",
          ]
        ) {
          const file = join(current, name);
          if (existsSync(file) && statSync(file).isFile()) return file;
        }
      }
      const parent = dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}
