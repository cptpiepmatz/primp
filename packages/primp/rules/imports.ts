/**
 * Built-in import-declaration comparators.
 *
 * Rule names describe what is compared or which imports come first. A rule
 * named for a feature (such as `nodePrefix`) puts imports with that feature
 * first: they compare as lesser than imports without it. Name and path rules
 * compare in ascending order. Prefer `inverse(rule)` over a negatively named
 * rule for the opposite order, as the default config does for side-effect and
 * namespace imports.
 *
 * @module
 */

import { dirname } from "node:path";

import type { Import } from "../src/core.ts";
import type { ImportCompareFunction } from "../src/rules.ts";

/**
 * Compares two imports by their presence of a default import.
 * An import with a default import is considered lesser (positioned higher).
 *
 * @example
 * ```ts
 * // unsorted
 * import {a, b, c} from "alpha";
 * import d, {e, f} from "beta";
 *
 * // sorted
 * import d, {e, f} from "beta";
 * import {a, b, c} from "alpha";
 * ```
 *
 * @see ImportElement#isDefault
 */
export const defaultImport: ImportCompareFunction = function (a, b) {
  const aDefault = a.defaultElement ? 0 : 1;
  const bDefault = b.defaultElement ? 0 : 1;
  return aDefault - bDefault;
};

/**
 * Compares default bindings by capitalization, putting uppercase names first.
 * This can group type-like names before value-like names as a heuristic; it
 * checks capitalization, not whether a binding is a TypeScript type.
 *
 * <i>This ignores imports without default imports.</i>
 *
 * @example
 * ```ts
 * // unsorted
 * import {gamma} from "Gamma";
 * import alpha from "Alpha";
 * import Beta from "Beta";
 *
 * // sorted
 * import {gamma} from "Gamma";
 * import Beta from "Beta";
 * import alpha from "Alpha";
 * ```
 */
export const uppercaseDefault: ImportCompareFunction = function (a, b) {
  const aDefault = a.defaultElement;
  const bDefault = b.defaultElement;
  if (!aDefault || !bDefault) return 0;
  return +/^[A-Z]/.test(bDefault.name) - +/^[A-Z]/.test(aDefault.name);
};

/**
 * Compare two imports by their presence of a namespace import.
 * An import with a namespace import is considered lesser (positioned higher).
 *
 * @example
 * ```ts
 * // unsorted
 * import alpha from "Alpha";
 * import * as beta from "Beta";
 *
 * // sorted
 * import * as beta from "Beta";
 * import alpha from "Alpha";
 * ```
 *
 * @see Import#isNamespace
 */
export const namespaceImport: ImportCompareFunction = function (a, b) {
  const aNamespace = a.isNamespace ? 0 : 1;
  const bNamespace = b.isNamespace ? 0 : 1;
  return aNamespace - bNamespace;
};

/**
 * Compares two imports by whether their source starts with the `node:` prefix.
 * An import with the prefix is considered lesser (positioned higher).
 *
 * @example
 * ```ts
 * // unsorted
 * import a from "alpha";
 * import fs from "node:fs";
 *
 * // sorted
 * import fs from "node:fs";
 * import a from "alpha";
 * ```
 */
export const nodePrefix: ImportCompareFunction = function (a, b) {
  const startsWithNode = (m: Import) => +(m.source.name.startsWith("node:"));
  return startsWithNode(b) - startsWithNode(a);
};

/**
 * Compares two path for their depth.
 * The deeper path is considered greater.
 *
 * <i>This ignores package names.</i>
 *
 * <b>Note: This does not take the path names into account.</b>
 *
 * @example
 * ```ts
 * // unsorted
 * import a from "./longer/path";
 * import b from "./short-path";
 *
 * // sorted
 * import b from "./short-path";
 * import a from "./longer/path";
 * ```
 */
export const pathDepth: ImportCompareFunction = function (a, b) {
  if ([a, b].some((m) => m.source.isPackage)) return 0;
  const [dirsA, dirsB] = [a, b].map((m) => m.source.name.split("/").length);
  return dirsA - dirsB;
};

/**
 * Compares two source paths by their dir hierarchy from top to bottom.
 * Every element of the tree is compared against the other source and
 * alphabetically ordered.
 *
 * <i>This ignores package names.</i>
 *
 * @example
 * ```ts
 * // unsorted
 * import c from "./alpha-beta/alpha/c";
 * import b from "./alpha/gamma/b";
 * import a from "./alpha/beta/a";
 *
 * // sorted
 * import a from "./alpha/beta/a";
 * import b from "./alpha/gamma/b";
 * import c from "./alpha-beta/alpha/c";
 * ```
 */
export const directoryName: ImportCompareFunction = function (a, b) {
  if ([a, b].some((m) => m.source.isPackage)) return 0;
  const [dirsA, dirsB] = [a, b].map((m) => dirname(m.source.name).split("/"));
  const minLength = Math.min(dirsA.length, dirsB.length);
  for (let i = 0; i < minLength; i++) {
    const comparison = dirsA[i].localeCompare(dirsB[i]);
    if (comparison) return comparison;
  }
  return 0;
};

/** Puts `import defer` declarations before other imports. */
export const deferred: ImportCompareFunction = function (a, b) {
  return +(b.phaseModifier === "defer") - +(a.phaseModifier === "defer");
};

/** Puts imports with a `with` or `assert` attribute clause first. */
export const importAttributes: ImportCompareFunction = function (a, b) {
  const hasAttributes = (m: Import) =>
    m.attributes.with !== undefined || m.attributes.assert !== undefined;
  return +hasAttributes(b) - +hasAttributes(a);
};

/**
 * Compares two imports whether they are for side effects only or not.
 * Imports with only side effects are considered lesser (higher position).
 *
 * @example
 * ```ts
 * // unsorted
 * import a from "alpha";
 * import "beta";
 * import c from "charlie";
 *
 * // sorted
 * import "beta";
 * import a from "alpha";
 * import c from "charlie";
 * ```
 */
export const sideEffect: ImportCompareFunction = function (a, b) {
  const aDefault = a.isSideEffectOnly ? 0 : 1;
  const bDefault = b.isSideEffectOnly ? 0 : 1;
  return aDefault - bDefault;
};

/**
 * Compares two import sources whether they are relatives or packages.
 * A relative path is considered greater (positioned lower).
 *
 * @example
 * ```ts
 * // unsorted
 * import b from "./Beta";
 * import c from "Gamma";
 * import a from "Alpha";
 *
 * // sorted
 * import c from "Gamma";
 * import a from "Alpha";
 * import b from "./Beta";
 * ```
 *
 * @see ImportSource#isPackage
 * @see ImportSource#isRelative
 */
export const packageFirst: ImportCompareFunction = function (a, b) {
  const aPackage = a.source.isPackage ? 0 : 1;
  const bPackage = b.source.isPackage ? 0 : 1;
  return aPackage - bPackage;
};

/**
 * Puts parent-directory (`../`) imports before same-directory (`./`) imports.
 * Leaves package imports undecided for other rules to order.
 */
export const parentPath: ImportCompareFunction = function (a, b) {
  if (!a.source.isRelative || !b.source.isRelative) return 0;
  return +b.source.name.startsWith("../") - +a.source.name.startsWith("../");
};

/**
 * Compares two imports based on their source name alphabetically.
 *
 * <i>This ignores relative sources. </i>
 *
 * @example
 * ```ts
 * // unsorted
 * import a from "beta";
 * import b from "alpha";
 *
 * // sorted
 * import b from "alpha";
 * import a from "beta";
 * ```
 */
export const sourceName: ImportCompareFunction = function (a, b) {
  if ([a, b].some((m) => m.source.isRelative)) return 0;
  return a.source.name.localeCompare(b.source.name);
};

/**
 * Compares two imports if they only import types.
 *
 * @example
 * ```ts
 * // unsorted
 * import { a } from "alpha";
 * import type { b } from "beta";
 * import { c } from "charlie";
 *
 * // sorted
 * import type { b } from "beta";
 * import { a } from "alpha";
 * import { c } from "charlie";
 * ```
 */
export const typeOnly: ImportCompareFunction = function (a, b) {
  return +(b.phaseModifier === "type") - +(a.phaseModifier === "type");
};
