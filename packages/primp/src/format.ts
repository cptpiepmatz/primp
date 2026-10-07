import { ConfigHandler } from "./configuration.ts";
import { ImportIntegrator, parseImports } from "./core.ts";
import { matchesExtractor } from "./extractors.ts";
import { ImportSeparator, ImportSorter } from "./rules.ts";

import type { Config } from "./configuration.ts";

/**
 * Format imports in the slices supplied by the filename's configured extractor.
 * TypeScript files use the built-in whole-file extractor. JavaScript files can
 * use the opt-in `jsExtractor`.
 * Files with no matching extractor are left unchanged.
 * All replacements are applied to the original text; non-source regions remain
 * unchanged. Invalid or overlapping slice offsets throw rather than corrupting
 * the file.
 */
export function formatImports(
  source: string,
  config: Config = {},
  filename = "input.ts",
): string {
  const options = config instanceof ConfigHandler
    ? config
    : new ConfigHandler(config);
  const extractor = options.extractors.find((adapter) =>
    matchesExtractor(adapter, filename)
  );
  if (!extractor) return source;
  const slices = extractor.extract(source, filename).sort((a, b) =>
    b.start - a.start
  );
  const sorter = new ImportSorter(
    options.sortImports,
    options.sortImportElements,
  );
  const separator = new ImportSeparator(options.separateBy);
  const integrator = new ImportIntegrator(options.formatting);
  let output = source;
  let nextStart = source.length;
  for (const { start, end, content } of slices) {
    if (
      !Number.isInteger(start) || !Number.isInteger(end) || start < 0 ||
      end < start || end > nextStart
    ) {
      throw new RangeError(
        `Invalid source slice in ${filename}: ${start}-${end}`,
      );
    }
    nextStart = start;
    const { sourceFile, imports } = parseImports(content, filename);
    if (!imports.length) continue;
    const formatted = integrator.integrate(
      sourceFile,
      separator.insertSeparator(sorter.sort(imports)),
    );
    output = output.slice(0, start) + formatted + output.slice(end);
  }
  return output;
}
