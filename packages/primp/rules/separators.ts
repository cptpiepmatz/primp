/** Built-in blank-line predicates for adjacent imports. @module */
import type { SeparateByFunction } from "../src/rules.ts";

/** Separate `node:` imports from other sources. */
export const unequalNodePrefix: SeparateByFunction = (a, b) =>
  a.source.name.startsWith("node:") !== b.source.name.startsWith("node:");
/** Separate side-effect imports from imports that bind names. */
export const unequalSideEffectUse: SeparateByFunction = (a, b) =>
  a.isSideEffectOnly !== b.isSideEffectOnly;
/** Separate package/bare sources from relative sources. */
export const unequalPackageState: SeparateByFunction = (a, b) =>
  a.source.isPackage !== b.source.isPackage;
/** Separate namespace imports from other imports. */
export const unequalNamespaceUse: SeparateByFunction = (a, b) =>
  a.isNamespace !== b.isNamespace;

/** All blank-line predicates, also available individually above. */
export const separateBy: Record<string, SeparateByFunction> = {
  unequalNodePrefix,
  unequalSideEffectUse,
  unequalPackageState,
  unequalNamespaceUse,
};
