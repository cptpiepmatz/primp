import type { ImportCompareFunction } from "../../../mod.ts";

/**
 * Example compare function for imports.
 * This does put imports with the source that end with ".js" first.
 * @param importA Import A
 * @param importB Import B
 */
const dotJSFirst: ImportCompareFunction = function (importA, importB): number {
  const matcher = /\.[Jj][Ss]$/;
  const matchesA = !!importA.source.name.match(matcher);
  const matchesB = !!importB.source.name.match(matcher);
  if (importA.source.isPackage && matchesA && !matchesB) return -1;
  if (importB.source.isPackage && !matchesA && matchesB) return 1;
  return 0;
};

export default dotJSFirst;
