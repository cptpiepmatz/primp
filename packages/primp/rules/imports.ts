/** Built-in import-declaration comparators. @module */
import type { ImportCompareFunction } from "../src/rules.ts";

const bool = (value: boolean): number => Number(value);
const compare = (a: string, b: string): number => a.localeCompare(b);

/** `node:` imports before all other sources. */
export const nodePrefix: ImportCompareFunction = (a, b) =>
  bool(b.source.name.startsWith("node:")) -
  bool(a.source.name.startsWith("node:"));
/** Side-effect-only imports before imports that bind names. */
export const sideEffect: ImportCompareFunction = (a, b) =>
  bool(b.isSideEffectOnly) - bool(a.isSideEffectOnly);
/** Package/bare specifiers before `./` and `../` sources. */
export const sourceType: ImportCompareFunction = (a, b) =>
  bool(a.source.isRelative) - bool(b.source.isRelative);
/** Namespace (`* as`) imports before other imports. */
export const namespacePresence: ImportCompareFunction = (a, b) =>
  bool(b.isNamespace) - bool(a.isNamespace);
/** Imports with default bindings before those without. */
export const defaultPresence: ImportCompareFunction = (a, b) =>
  bool(!!b.defaultElement) - bool(!!a.defaultElement);
/** Uppercase default names before lowercase ones; ignores missing defaults. */
export const defaultType: ImportCompareFunction = (a, b) =>
  a.defaultElement && b.defaultElement
    ? bool(b.defaultElement.isType) - bool(a.defaultElement.isType)
    : 0;
/** Sort package names alphabetically; does not compare relative sources. */
export const sourceName: ImportCompareFunction = (a, b) =>
  a.source.isRelative || b.source.isRelative
    ? 0
    : compare(a.source.name, b.source.name);
/** Shorter relative paths first; does not compare package sources. */
export const pathDepth: ImportCompareFunction = (a, b) =>
  a.source.isPackage || b.source.isPackage
    ? 0
    : a.source.name.split("/").length - b.source.name.split("/").length;
/** Compare relative paths by parent-directory segments, ignoring filenames. */
export const pathName: ImportCompareFunction = (a, b) => {
  if (a.source.isPackage || b.source.isPackage) return 0;
  const partsA = a.source.name.split("/").slice(0, -1);
  const partsB = b.source.name.split("/").slice(0, -1);
  for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
    const result = compare(partsA[i], partsB[i]);
    if (result) return result;
  }
  return 0;
};

/** All import-declaration comparators, also available individually above. */
export const compareImports: Record<string, ImportCompareFunction> = {
  nodePrefix,
  sideEffect,
  sourceType,
  namespacePresence,
  defaultPresence,
  defaultType,
  sourceName,
  pathDepth,
  pathName,
};
