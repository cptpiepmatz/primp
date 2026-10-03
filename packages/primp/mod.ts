/**
 * Parse, sort, group, and format TypeScript imports.
 *
 * ```ts
 * import { formatImports } from "jsr:@primp/primp";
 *
 * const output = formatImports('import {b, a} from "pkg";\n');
 * ```
 *
 * See {@link ImportCompareFunction}, {@link ImportElementCompareFunction}, and
 * {@link SeparateByFunction} to write custom rules in a config file. Built-in
 * rules are available from `/rules/imports`, `/rules/elements`, and
 * `/rules/separators`; `inverse` is available here. Other file formats can
 * register an {@link Extractor} in the config.
 * @module
 */

export { Import, ImportIntegrator, parseImports } from "./src/core.ts";
export type {
  FormattingOptions,
  ImportElement,
  ImportSource,
} from "./src/core.ts";
export type { SourceFile } from "typescript";
export { extractSource, jsExtractor, tsExtractor } from "./src/extractors.ts";
export type { Extractor, SourceSlice } from "./src/extractors.ts";
export { formatImports } from "./src/format.ts";
export { FileManager } from "./src/files.ts";
export { ImportSeparator, ImportSorter, inverse } from "./src/rules.ts";
export type {
  ImportCompareFunction,
  ImportElementCompareFunction,
  SeparateByFunction,
} from "./src/rules.ts";
export {
  ConfigHandler,
  defaultConfig,
  defineConfig,
} from "./src/configuration.ts";
export type { Config, FullConfig } from "./src/configuration.ts";

/** Configuration types, defaults, and TypeScript config discovery. */
export * as config from "./src/configuration.ts";
