/**
 * Shared rule types, comparator helpers, and sorting/grouping orchestration.
 * Built-in rule implementations live in `rules/`.
 *
 * @module
 */

import type { Import, ImportElement } from "./core.ts";

/**
 * A function for comparing import declarations.
 *
 * Use these functions in `sortImports`. Wrap a comparator in {@link inverse}
 * to reverse its result.
 *
 * @see {@link ImportElementCompareFunction}
 */
export interface ImportCompareFunction {
  /**
   * Compare two imports.
   *
   * Return zero when they are equal or this rule cannot decide, so the next
   * configured comparator can decide their order. Negative and positive
   * numbers are accepted for consistency with JavaScript sort comparators,
   * although custom rules will usually return `-1` or `1`.
   *
   * @param importA First import to compare.
   * @param importB Second import to compare.
   * @returns Negative (usually `-1`) to put A before B, zero to leave their
   * order undecided, or positive (usually `1`) to put B before A.
   */
  (importA: Import, importB: Import): -1 | 0 | 1 | number;
}

/**
 * A function for comparing import elements.
 *
 * Only elements within the same import declaration are compared.
 *
 * @see {@link ImportCompareFunction}
 */
export interface ImportElementCompareFunction {
  /**
   * Compare two import elements.
   *
   * Return zero when they are equal or this rule cannot decide, so the next
   * configured comparator can decide their order. Negative and positive
   * numbers are accepted for consistency with JavaScript sort comparators,
   * although custom rules will usually return `-1` or `1`.
   *
   * @param importElementA First import element to compare.
   * @param importElementB Second import element to compare.
   * @returns Negative (usually `-1`) to put A before B, zero to leave their
   * order undecided, or positive (usually `1`) to put B before A.
   */
  (
    importElementA: ImportElement,
    importElementB: ImportElement,
  ): -1 | 0 | 1 | number;
}

/** A function for deciding whether adjacent imports need a separator. */
export interface SeparateByFunction {
  /**
   * Decide whether to separate two imports.
   *
   * The imports are adjacent in sorted order. Returning `true` requests an
   * empty line between them.
   *
   * @param leadingImport Import before the potential separator.
   * @param followingImport Import after the potential separator.
   * @returns `true` to insert an empty line, or `false` to keep them together.
   */
  (leadingImport: Import, followingImport: Import): boolean;
}

/** Reverse a comparator's ordering, preserving undecided (zero) results. */
export function inverse<T>(
  rule: (a: T, b: T) => number,
): (a: T, b: T) => number {
  return function (a: T, b: T): number {
    return -rule(a, b);
  };
}

/** Sort imports and their specifiers using ordered comparator functions. */
export class ImportSorter {
  /** Ordered import-declaration comparators. */
  readonly sortImportOrder: ImportCompareFunction[];

  /** Ordered named-specifier comparators. */
  readonly sortImportElementOrder: ImportElementCompareFunction[];

  /**
   * @param sortImports Import comparators, in priority order.
   * @param sortImportElements Binding comparators, in priority order.
   */
  constructor(
    sortImports: ImportCompareFunction[],
    sortImportElements: ImportElementCompareFunction[],
  ) {
    this.sortImportOrder = sortImports;
    this.sortImportElementOrder = sortImportElements;
  }

  /**
   * Chain comparators in priority order.
   *
   * Stop at the first nonzero result, or return zero if no rule decides.
   *
   * @param rules Comparators in priority order.
   * @returns A comparator that returns zero if none of the rules decides.
   */
  static chainCompareFunctions<T>(
    rules: ((a: T, b: T) => number)[],
  ): (a: T, b: T) => number {
    return function (a: T, b: T): number {
      for (const rule of rules) {
        const result = rule(a, b);
        if (result) return result;
      }
      return 0;
    };
  }

  /**
   * Reverse a comparator's ordering.
   *
   * Negate its numeric result, leaving zero unchanged.
   *
   * @param rule Comparator to invert.
   * @returns A comparator with the opposite ordering.
   */
  static inverseComparator<T>(
    rule: (a: T, b: T) => number,
  ): (a: T, b: T) => number {
    return function (a: T, b: T): number {
      return -rule(a, b);
    };
  }

  /**
   * Sort imports and their elements in place.
   *
   * Apply the element rules to each import before sorting the declarations.
   *
   * @param imports Import declarations to sort.
   * @returns The same array, now sorted by the configured rules.
   */
  sort(imports: Import[]): Import[] {
    const importCompare = ImportSorter.chainCompareFunctions(
      this.sortImportOrder,
    );
    const importElementCompare = ImportSorter.chainCompareFunctions(
      this.sortImportElementOrder,
    );

    for (const imported of imports) {
      imported.sort(importElementCompare);
    }
    return imports.sort(importCompare);
  }
}

/** Insert separators between sorted imports when any configured predicate matches. */
export class ImportSeparator {
  /** Separator predicates; their order does not affect grouping. */
  readonly separateByRules: SeparateByFunction[];

  /**
   * @param rules Separator predicates to apply.
   */
  constructor(rules: SeparateByFunction[]) {
    this.separateByRules = rules;
  }

  /**
   * Insert separators between sorted imports.
   *
   * Insert one `null` at each boundary matched by any configured predicate.
   *
   * @param imports Sorted imports to group.
   * @returns A new array with at most one blank-line marker per boundary.
   */
  insertSeparator(imports: Import[]): (Import | null)[] {
    const result: (Import | null)[] = [];
    for (const imported of imports) {
      const previous = result[result.length - 1];
      if (
        previous &&
        this.separateByRules.some((rule) => rule(previous, imported))
      ) result.push(null);
      result.push(imported);
    }
    return result;
  }
}
