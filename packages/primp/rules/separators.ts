/**
 * Built-in rules for separating adjacent imports with blank lines.
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
export const unequalNodePrefix: SeparateByFunction = function (l, f) {
  const leadingIsNode = l.source.name.startsWith("node:");
  const followingIsNode = f.source.name.startsWith("node:");
  return leadingIsNode !== followingIsNode;
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
export const unequalSideEffectUse: SeparateByFunction = function (l, f) {
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
export const unequalTypeOnlyUse: SeparateByFunction = function (l, f) {
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
export const unequalPackageState: SeparateByFunction = function (l, f) {
  return l.source.isPackage !== f.source.isPackage;
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
export const unequalNamespaceUse: SeparateByFunction = function (l, f) {
  return l.isNamespace !== f.isNamespace;
};
