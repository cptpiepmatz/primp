/**
 * Parse, sort, group, and format TypeScript imports.
 *
 * The rest of the source file is left unchanged. The defaults follow Deno's
 * import formatting; configure {@link ImportSorter} and
 * {@link ImportSeparator} to opt into other rules.
 *
 * ```ts
 * import {
 *   ConfigHandler, ImportIntegrator, ImportSeparator, ImportSorter, parseImports,
 * } from "jsr:@cptpiepmatz/pretty-ts-imports";
 *
 * const config = new ConfigHandler();
 * const { sourceFile, imports } = parseImports('import {b, a} from "pkg";\n');
 * const sorted = new ImportSorter(config.sortImports, config.sortImportElements)
 *   .sort(imports);
 * const grouped = new ImportSeparator(config.separateBy).insertSeparator(sorted);
 * const output = new ImportIntegrator(config.formatting).integrate(sourceFile, grouped);
 * ```
 *
 * See {@link ImportCompareFunction}, {@link ImportElementCompareFunction}, and
 * {@link SeparateByFunction} to write custom ESM rules for a config file.
 * @module
 */
export { Import, ImportIntegrator, parseImports } from "./src/core.ts";
export type {
  FormattingOptions,
  ImportElement,
  ImportSource,
} from "./src/core.ts";
/** TypeScript AST returned alongside the parsed imports. */
export type { SourceFile } from "typescript";
export { FileManager } from "./src/files.ts";
export {
  builtin,
  ImportSeparator,
  ImportSorter,
  InvalidConfigError,
} from "./src/rules.ts";
export type {
  ImportCompareFunction,
  ImportElementCompareFunction,
  SeparateByFunction,
} from "./src/rules.ts";
export {
  ConfigHandler,
  defaultConfig,
  loadRules,
} from "./src/configuration.ts";
export type {
  Config,
  FullConfig,
  RequiredFunction,
} from "./src/configuration.ts";

/** Configuration types, defaults, file discovery, and custom-rule loading. */
export * as config from "./src/configuration.ts";
/** Legacy namespace containing `InvalidConfigError` and the rule exports. */
export * as error from "./src/rules.ts";
