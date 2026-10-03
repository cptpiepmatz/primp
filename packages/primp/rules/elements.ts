/**
 * Built-in named-import-element comparators.
 *
 * @module
 */

import type { ImportElementCompareFunction } from "../src/rules.ts";

/**
 * Compares two import elements based on their names split apart on capital
 * letters.
 * Then this runs the sub words in reverse order to check for likeness.
 * If all sub words are the same but one is longer this will be recognized as
 * equal.
 *
 * <i>This ignores every element that is not a type.</i>
 *
 * @example
 * ```ts
 * // unsorted
 * import {StartBase, Stuff, OtherBase, PowStuff} from "stuff";
 *
 * // sorted
 * import {StartBase, OtherBase, Stuff, PowStuff} from "stuff";
 * ```
 *
 * @see ImportElement#isFunctionOrObject
 */
export const basenameGroup: ImportElementCompareFunction = function (a, b) {
  if (a.isFunctionOrObject || b.isFunctionOrObject) return 0;

  const matcher = /([A-Z][a-z]*)/g;
  const aMatches = a.name.match(matcher);
  const bMatches = b.name.match(matcher);

  const aParts = Array.from(aMatches as string[]).reverse();
  const bParts = Array.from(bMatches as string[]).reverse();
  const partsLength = Math.min(aParts.length, bParts.length);

  for (let i = 0; i < partsLength; i++) {
    const comparison = aParts[i].localeCompare(bParts[i]);
    if (comparison !== 0) return comparison;
  }
  return 0;
};

/**
 * Compares two import element names by their name alphabetically.
 *
 * @example
 * ```ts
 * // unsorted
 * import {c, d, e, a} from "alphabet";
 *
 * // sorted
 * import {a, b, c, d} from "alphabet";
 * ```
 */
export const elementName: ImportElementCompareFunction = function (a, b) {
  return a.name.localeCompare(b.name);
};

/**
 * Compares two import elements whether they are a function, object or Type.
 * If both elements are the same the will recognized as equal.
 *
 * @example
 * ```ts
 * // unsorted
 * import {a, B, C, d} from "alphabet";
 *
 * // sorted
 * import {a, d, B, C} from "alphabet";
 * ```
 *
 * @see ImportElement#isFunctionOrObject
 * @see ImportElement#isType
 */
export const elementType: ImportElementCompareFunction = function (a, b) {
  const [aFunction, bFunction] = [a, b].map((m) => +m.isFunctionOrObject);
  return bFunction - aFunction;
};

/**
 * Compares import elements alphabetically by their original specifier names,
 * ignoring case. For unaliased elements, uses their local names instead.
 *
 * @example
 * ```ts
 * // unsorted
 * import {z as a, b as z, a as y} from "alphabet";
 *
 * // sorted
 * import {a as y, b as z, z as a} from "alphabet";
 * ```
 */
export const specifierName: ImportElementCompareFunction = function (a, b) {
  const [aName, bName] = [a, b].map((m) => m.originalName ?? m.name);
  return aName.toLowerCase().localeCompare(bName.toLowerCase());
};
