/** Built-in named-import-element comparators. @module */
import type { ImportElementCompareFunction } from "../src/rules.ts";

const compare = (a: string, b: string): number => a.localeCompare(b);
const denoCompare = (a: string, b: string): number => {
  const folded = a.toLowerCase().localeCompare(b.toLowerCase());
  return folded || (a < b ? -1 : a > b ? 1 : 0);
};

/** Deno-style order: imported name first, then local alias. */
export const specifierName: ImportElementCompareFunction = (a, b) =>
  denoCompare(a.originalName ?? a.name, b.originalName ?? b.name) ||
  denoCompare(a.name, b.name);
/** Lowercase-name heuristic before uppercase-name heuristic. */
export const elementType: ImportElementCompareFunction = (a, b) =>
  Number(b.isFunctionOrObject) - Number(a.isFunctionOrObject);
/** Alphabetical order by local binding name, including aliases. */
export const elementName: ImportElementCompareFunction = (a, b) =>
  compare(a.name, b.name);
/** Group uppercase names by CamelCase words from right to left. */
export const basenameGroup: ImportElementCompareFunction = (a, b) => {
  if (a.isFunctionOrObject || b.isFunctionOrObject) return 0;
  const aParts = (a.name.match(/[A-Z][a-z]*/g) ?? []).reverse();
  const bParts = (b.name.match(/[A-Z][a-z]*/g) ?? []).reverse();
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const result = compare(aParts[i], bParts[i]);
    if (result) return result;
  }
  return 0;
};

/** All named-import-element comparators, also available individually above. */
export const compareImportElements: Record<
  string,
  ImportElementCompareFunction
> = {
  specifierName,
  elementType,
  elementName,
  basenameGroup,
};
