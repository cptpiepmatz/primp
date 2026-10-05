/**
 * Built-in rules for separating adjacent imports with blank lines.
 *
 * Each rule is named for the feature that defines a group. It returns `true`
 * when exactly one of two adjacent imports has that feature, placing a blank
 * line at the boundary. Unlike import comparators, separator rules do not
 * determine which group comes first; configure sorting separately.
 *
 * @module
 */

import type { SeparateByFunction } from "../src/rules.ts";

/**
 * Place a separator between two imports if one source starts with `node:`
 * and the other does not.
 *
 * @example
 * ```ts
 * // unseparated
 * import fs from "node:fs";
 * import path from "node:path";
 * import pkg from "package";
 *
 * // separated
 * import fs from "node:fs";
 * import path from "node:path";
 *
 * import pkg from "package";
 * ```
 */
export const nodePrefix: SeparateByFunction = function (l, f) {
  const leadingIsNode = l.source.name.startsWith("node:");
  const followingIsNode = f.source.name.startsWith("node:");
  return leadingIsNode !== followingIsNode;
};

/** Separate `import defer` declarations from other imports. */
export const deferred: SeparateByFunction = function (l, f) {
  return (l.phaseModifier === "defer") !== (f.phaseModifier === "defer");
};

/** Separate imports with `with` or `assert` attributes from other imports. */
export const importAttributes: SeparateByFunction = function (l, f) {
  const hasAttributes = (m: typeof l) =>
    m.attributes.with !== undefined || m.attributes.assert !== undefined;
  return hasAttributes(l) !== hasAttributes(f);
};

/**
 * Place a separator between two imports if one of them is importing only for
 * side effects.
 *
 * @example
 * ```ts
 * // unseparated
 * import a from "alpha";
 * import b from "bravo";
 * import "charlie";
 * import "delta";
 * import e from "echo";
 *
 * // separated
 * import a from "alpha";
 * import b from "bravo";
 *
 * import "charlie";
 * import "delta";
 *
 * import e from "echo";
 * ```
 * @see Import#isSideEffectOnly
 * @param l Leading Import
 * @param f Following Import
 */
export const sideEffect: SeparateByFunction = function (l, f) {
  return l.isSideEffectOnly !== f.isSideEffectOnly;
};

/**
 * Place a separator between type-only imports and imports with values.
 *
 * @example
 * ```ts
 * // unseparated
 * import type { A } from "alpha";
 * import type { B } from "bravo";
 * import c from "charlie";
 *
 * // separated
 * import type { A } from "alpha";
 * import type { B } from "bravo";
 *
 * import c from "charlie";
 * ```
 * @see Import#phaseModifier
 * @param l Leading Import
 * @param f Following Import
 */
export const typeOnly: SeparateByFunction = function (l, f) {
  return (l.phaseModifier === "type") !== (f.phaseModifier === "type");
};

/**
 * Place a separator between two imports if one of them is imported from a
 * package and the other one from a relative path.
 *
 * @example
 * ```ts
 * // unseparated
 * import a from "alpha";
 * import b from "beta";
 * import c from "./gamma";
 * import d from "./delta";
 * import e from "epsilon";
 *
 * // separated
 * import a from "alpha";
 * import b from "beta";
 *
 * import c from "./gamma";
 * import d from "./delta";
 *
 * import e from "epsilon";
 * ```
 *
 * @see ImportElement#isPackage
 * @see ImportElement#isRelative
 * @param leading Leading Import
 * @param following Following Import
 */
export const packageSource: SeparateByFunction = function (l, f) {
  return l.source.isPackage !== f.source.isPackage;
};

/** Separate parent-directory (`../`) imports from same-directory (`./`) imports. */
export const parentPath: SeparateByFunction = function (l, f) {
  if (!l.source.isRelative || !f.source.isRelative) return false;
  return l.source.name.startsWith("../") !==
    f.source.name.startsWith("../");
};

/**
 * Place a separator between two imports if one of them is using a namespace
 * import and the other one is not.
 *
 * @example
 * ```ts
 * // unseparated
 * import everything from "stuff";
 * import everyone from "people";
 * import * as everywhere from "places";
 * import * as everyway from "ways";
 * import everybody from "persons";
 *
 * // separated
 * import everything from "stuff";
 * import everyone from "people";
 *
 * import * as everywhere from "places";
 * import * as everyway from "ways";
 *
 * import everybody from "persons";
 * ```
 * @see Import#isNamespace
 * @param l Leading Import
 * @param f Following Import
 */
export const namespace: SeparateByFunction = function (l, f) {
  return l.isNamespace !== f.isNamespace;
};
