/** Extract script blocks from Vue single-file components. @module */
import { parse } from "@vue/compiler-sfc";

import type { Extractor, SourceSlice } from "@primp/primp";

/**
 * Extract `<script>` and `<script setup>` content for primp to format.
 * External scripts and unsupported script languages produce no slices.
 * If the component cannot be parsed, return no slices so the file stays intact.
 *
 * @param source Complete Vue SFC source.
 * @param filename Filename used by the Vue parser for diagnostics.
 * @returns Script source and its location in the original component.
 */
export function extractVueScripts(
  source: string,
  filename = "component.vue",
): SourceSlice[] {
  const { descriptor, errors } = parse(source, { filename });
  if (errors.length) return [];

  return [descriptor.script, descriptor.scriptSetup]
    .filter((script): script is NonNullable<typeof script> =>
      script !== null && !script.src &&
      (!script.lang || ["js", "jsx", "ts", "tsx"].includes(script.lang))
    )
    .map((script) => ({
      start: script.loc.start.offset,
      end: script.loc.end.offset,
      content: script.content,
    }));
}

/** Vue SFC adapter for `Config.extractors`. */
export const vueExtractor: Extractor = {
  extensions: ".vue",
  extract: extractVueScripts,
};
