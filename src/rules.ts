import type { Import, ImportElement } from "./core.ts";

/**
 * A function for comparing import declarations.
 *
 * Use these functions in `sortImports`. Prefix a configured rule name with `!`
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

const compare = (a: string, b: string): number => a.localeCompare(b);
const denoCompare = (a: string, b: string): number => {
  const folded = a.toLowerCase().localeCompare(b.toLowerCase());
  return folded || (a < b ? -1 : a > b ? 1 : 0);
};
const bool = (value: boolean): number => Number(value);
const isNodePrefix = (imported: Import): boolean =>
  imported.source.name.startsWith("node:");

/** Built-in import comparators available by key in `sortImports`. */
export const compareImports: Record<string, ImportCompareFunction> = {
  /** `node:` imports before all other sources. */
  nodePrefix: (a, b) => bool(isNodePrefix(b)) - bool(isNodePrefix(a)),
  /** Side-effect-only imports before imports that bind names. */
  sideEffect: (a, b) => bool(b.isSideEffectOnly) - bool(a.isSideEffectOnly),
  /** Package/bare specifiers before `./` and `../` sources. */
  sourceType: (a, b) => bool(a.source.isRelative) - bool(b.source.isRelative),
  /** Namespace (`* as`) imports before other imports. */
  namespacePresence: (a, b) => bool(b.isNamespace) - bool(a.isNamespace),
  /** Imports with default bindings before those without. */
  defaultPresence: (a, b) =>
    bool(!!b.defaultElement) - bool(!!a.defaultElement),
  /** Uppercase default names before lowercase ones; ignores missing defaults. */
  defaultType: (a, b) =>
    a.defaultElement && b.defaultElement
      ? bool(b.defaultElement.isType) - bool(a.defaultElement.isType)
      : 0,
  /** Sort package names alphabetically; does not compare relative sources. */
  sourceName: (a, b) =>
    a.source.isRelative || b.source.isRelative
      ? 0
      : compare(a.source.name, b.source.name),
  /** Shorter relative paths first; does not compare package sources. */
  pathDepth: (a, b) =>
    a.source.isPackage || b.source.isPackage
      ? 0
      : a.source.name.split("/").length - b.source.name.split("/").length,
  /** Compare relative paths by parent-directory segments, ignoring filenames. */
  pathName: (a, b) => {
    if (a.source.isPackage || b.source.isPackage) return 0;
    const partsA = a.source.name.split("/").slice(0, -1);
    const partsB = b.source.name.split("/").slice(0, -1);
    for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
      const result = compare(partsA[i], partsB[i]);
      if (result) return result;
    }
    return 0;
  },
};

/** Built-in specifier comparators available by key in `sortImportElements`. */
export const compareImportElements: Record<
  string,
  ImportElementCompareFunction
> = {
  /** Deno-style order: imported name first, then local alias. */
  specifierName: (a, b) =>
    denoCompare(a.originalName ?? a.name, b.originalName ?? b.name) ||
    denoCompare(a.name, b.name),
  /** Lowercase-name heuristic before uppercase-name heuristic. */
  elementType: (a, b) =>
    bool(b.isFunctionOrObject) - bool(a.isFunctionOrObject),
  /** Alphabetical order by local binding name, including aliases. */
  elementName: (a, b) => compare(a.name, b.name),
  /** Group uppercase names by CamelCase words from right to left. */
  basenameGroup: (a, b) => {
    if (a.isFunctionOrObject || b.isFunctionOrObject) return 0;
    const aParts = (a.name.match(/[A-Z][a-z]*/g) ?? []).reverse();
    const bParts = (b.name.match(/[A-Z][a-z]*/g) ?? []).reverse();
    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
      const result = compare(aParts[i], bParts[i]);
      if (result) return result;
    }
    return 0;
  },
};

/** Built-in separator predicates available by key in `separateBy`. */
export const separateBy: Record<string, SeparateByFunction> = {
  /** Separate `node:` imports from other sources. */
  unequalNodePrefix: (a, b) => isNodePrefix(a) !== isNodePrefix(b),
  /** Separate side-effect imports from imports that bind names. */
  unequalSideEffectUse: (a, b) => a.isSideEffectOnly !== b.isSideEffectOnly,
  /** Separate package/bare sources from relative sources. */
  unequalPackageState: (a, b) => a.source.isPackage !== b.source.isPackage,
  /** Separate namespace imports from other imports. */
  unequalNamespaceUse: (a, b) => a.isNamespace !== b.isNamespace,
};

/** Built-in rules grouped by the kind of values they compare. */
export const builtin = { compareImports, compareImportElements, separateBy };

/** Thrown when a configured sort or separator rule cannot be found. */
export class InvalidConfigError extends Error {
  /** Name of the rule that could not be resolved. */
  readonly rule: string;

  /**
   * Report a missing rule.
   *
   * Include the rule name in both the error message and the `rule` property.
   *
   * @param message Description of the configuration error.
   * @param rule Name of the unresolved rule.
   */
  constructor(message: string, rule: string) {
    super(`${message}: ${rule}`);
    this.name = "InvalidConfigError";
    this.rule = rule;
  }
}

function resolveRules<T>(
  names: string[],
  available: Record<string, T>,
  inverse: boolean,
): T[] {
  return names.map((name) => {
    const key = inverse && name.startsWith("!") ? name.slice(1) : name;
    const rule = Object.hasOwn(available, key) ? available[key] : undefined;
    if (typeof rule !== "function") {
      throw new InvalidConfigError("Unknown rule", name);
    }
    return inverse && key !== name
      ? ((a: Import & ImportElement, b: Import & ImportElement) =>
        -(rule as (
          a: Import & ImportElement,
          b: Import & ImportElement,
        ) => number)(a, b)) as T
      : rule;
  });
}

/** Resolve configured comparator names and sort imports and their specifiers. */
export class ImportSorter {
  /** Ordered import-declaration comparators, including inverted rules. */
  readonly sortImportOrder: ImportCompareFunction[];
  /** Ordered named-specifier comparators, including inverted rules. */
  readonly sortImportElementOrder: ImportElementCompareFunction[];

  /**
   * Resolve the configured import and element comparators.
   *
   * Custom rules may override built-in rules with the same name.
   *
   * @param sortImports Names of import comparators, in priority order.
   * @param sortImportElements Names of binding comparators, in priority order.
   * @param custom Additional functions by name; these can override built-ins.
   * @throws {InvalidConfigError} When a named rule is missing.
   */
  constructor(
    sortImports: string[],
    sortImportElements: string[],
    custom: Record<string, unknown> = {},
  ) {
    this.sortImportOrder = resolveRules(sortImports, {
      ...compareImports,
      ...custom,
    }, true) as ImportCompareFunction[];
    this.sortImportElementOrder = resolveRules(sortImportElements, {
      ...compareImportElements,
      ...custom,
    }, true) as ImportElementCompareFunction[];
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
    return (a, b) => {
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
    return (a, b) => -rule(a, b);
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
    const elements = ImportSorter.chainCompareFunctions(
      this.sortImportElementOrder,
    );
    for (const imported of imports) imported.sort(elements);
    return imports.sort(
      ImportSorter.chainCompareFunctions(this.sortImportOrder),
    );
  }
}

/** Insert separators between sorted imports when any configured predicate matches. */
export class ImportSeparator {
  /** Resolved separator predicates; their order does not affect grouping. */
  readonly separateByRules: SeparateByFunction[];

  /**
   * Resolve the configured separator predicates.
   *
   * Custom rules may override built-in predicates with the same name.
   *
   * @param names Names of separator predicates to apply.
   * @param custom Additional functions by name; these can override built-ins.
   * @throws {InvalidConfigError} When a named predicate is missing.
   */
  constructor(names: string[], custom: Record<string, unknown> = {}) {
    this.separateByRules = resolveRules(
      names,
      { ...separateBy, ...custom },
      false,
    ) as SeparateByFunction[];
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
