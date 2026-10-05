/**
 * Built-in named-import-element comparators.
 *
 * Rule names describe what is compared or which elements come first. A rule
 * named for a feature puts elements with that feature first (compares them as
 * lesser); names such as `lowercaseFirst` state the ordering directly. Name
 * comparisons are ascending. Prefer `inverse(rule)` over a negatively named
 * rule to reverse an ordering.
 *
 * @module
 */

import type { ImportElement } from "../src/core.ts";
import type { ImportElementCompareFunction } from "../src/rules.ts";

function startsWithUppercase(element: ImportElement): boolean {
  return /^[A-Z]/.test(element.originalName ?? element.name);
}

/**
 * Compares two import elements based on their names split apart on capital
 * letters.
 * Then this runs the sub words in reverse order to check for likeness.
 * This can group related type names by their shared suffix (such as `Base`),
 * using capitalization as a heuristic rather than checking TypeScript types.
 * If all sub words are the same but one is longer this will be recognized as
 * equal.
 *
 * <i>This ignores names that do not start with an uppercase letter.</i>
 *
 * @example
 * ```ts
 * // unsorted
 * import {StartBase, Stuff, OtherBase, PowStuff} from "stuff";
 *
 * // sorted
 * import {StartBase, OtherBase, Stuff, PowStuff} from "stuff";
 * ```
 */
export const nameSuffix: ImportElementCompareFunction = function (a, b) {
  if (!startsWithUppercase(a) || !startsWithUppercase(b)) return 0;

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
 * Puts lowercase-named elements before uppercase-named elements.
 * This is a heuristic for grouping functions and objects (often lowercase)
 * before types (often uppercase). It checks the imported name's capitalization,
 * not whether an element is actually a TypeScript type or value.
 *
 * @example
 * ```ts
 * // unsorted
 * import {a, B, C, d} from "alphabet";
 *
 * // sorted
 * import {a, d, B, C} from "alphabet";
 * ```
 */
export const lowercaseFirst: ImportElementCompareFunction = function (a, b) {
  return +startsWithUppercase(a) - +startsWithUppercase(b);
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
