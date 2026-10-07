import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { elementName, specifierName } from "../rules/elements.ts";
import {
  declarationText,
  nodePrefix,
  packageSource,
  parentPath,
  sideEffect,
  sourcePath,
  typeOnly,
} from "../rules/imports.ts";
import * as separators from "../rules/separators.ts";
import { defaultFormattingOptions } from "./core.ts";
import { tsExtractor } from "./extractors.ts";
import * as ops from "./rules.ts";

import type { FormattingOptions } from "./core.ts";
import type { Extractor } from "./extractors.ts";
import type {
  ImportCompareFunction,
  ImportElementCompareFunction,
  SeparateByFunction,
} from "./rules.ts";

/** Options for formatting, sorting, and grouping imports. */
export interface Config {
  /** Import comparators in priority order; use `inverse(rule)` to reverse one. */
  sortImports?: ImportCompareFunction[];

  /** Comparators for elements within each import. */
  sortImportElements?: ImportElementCompareFunction[];

  /** Predicates that separate adjacent imports with a blank line. */
  separateBy?: SeparateByFunction[];

  /** Overrides for rendered import declarations. */
  formatting?: FormattingOptions;

  /** Ordered extractors; the first matching adapter handles a file. */
  extractors?: Extractor[];
}

/** Provide type checking and editor completion for a config's default export. */
export function defineConfig(config: Config): Config {
  return config;
}

/** A config with every optional field filled in from the defaults. */
export type FullConfig = Required<Config> & {
  formatting: Required<FormattingOptions>;
};

/** Side effects, then built-ins, packages, parents, locals; values before types. */
export const defaultConfig: FullConfig = {
  extractors: [tsExtractor],
  sortImports: [
    sideEffect,
    nodePrefix,
    packageSource,
    parentPath,
    ops.inverse(typeOnly),
    sourcePath,
    declarationText,
  ],
  sortImportElements: [specifierName, elementName],
  separateBy: [
    separators.sideEffect,
    separators.nodePrefix,
    separators.packageSource,
    separators.typeOnly,
  ],
  formatting: { ...defaultFormattingOptions },
};

/** Resolve defaults and discover TypeScript config files. */
export class ConfigHandler implements FullConfig {
  readonly extractors: Extractor[];
  readonly sortImports: ImportCompareFunction[];
  readonly sortImportElements: ImportElementCompareFunction[];
  readonly separateBy: SeparateByFunction[];
  readonly formatting: Required<FormattingOptions>;

  /** Fill in omitted fields from the defaults. */
  constructor(config: Config = {}) {
    this.extractors = config.extractors ?? [...defaultConfig.extractors];
    this.sortImports = config.sortImports ?? [...defaultConfig.sortImports];
    this.sortImportElements = config.sortImportElements ??
      [...defaultConfig.sortImportElements];
    this.separateBy = config.separateBy ?? [...defaultConfig.separateBy];
    this.formatting = { ...defaultConfig.formatting, ...config.formatting };
  }

  /** Import a config module. The runtime must support TypeScript modules. */
  static async load(path?: string): Promise<ConfigHandler> {
    if (!path) return new ConfigHandler();
    const url = pathToFileURL(resolve(path)).href;
    const module: { default?: unknown } = await import(url);
    const value = module.default;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Config must default-export an object: ${path}`);
    }
    return new ConfigHandler(value as Config);
  }

  /** Search from a file or directory upward for a config file. */
  static findConfig(entryPoint: string): string | undefined {
    const expectedFileNames = [
      "primp.config.ts",
      "primp.config.mts",
      "primp.config.js",
      "primp.config.mjs",
    ];

    let current = resolve(entryPoint);
    while (true) {
      for (const fileName of expectedFileNames) {
        const candidate = join(current, fileName);
        try {
          if (statSync(candidate).isFile()) return candidate;
        } catch { /* Ignore failed lookups. */ }
      }

      const parent = dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}
