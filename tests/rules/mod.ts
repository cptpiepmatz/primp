import { expect as stdExpect } from "@std/expect";

import {
  ImportIntegrator,
  ImportSeparator,
  ImportSorter,
  parseImports,
} from "@primp/primp";
import type { Import, ImportElement } from "@primp/primp";

// Indented TypeScript fixtures with a single final newline.
// The ts tag can also be recognized by VS Code tagged-template highlighters.
export function ts(strings: TemplateStringsArray): string {
  const lines = strings[0].replaceAll("\r\n", "\n").split("\n");
  if (!lines[0].trim()) lines.shift();
  if (!lines.at(-1)?.trim()) lines.pop();
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) =>
      line.match(/^[ \t]*/)?.[0].length ?? 0
    ),
  );
  return lines.map((line) => line.trim() ? line.slice(indent) : "").join("\n") +
    "\n";
}

export function expect(input: string) {
  return {
    viaSeparator(separator: (a: Import, b: Import) => boolean) {
      const { sourceFile, imports } = parseImports(input);
      const separated = new ImportSeparator([separator]).insertSeparator(
        imports,
      );
      return stdExpect(new ImportIntegrator().integrate(sourceFile, separated));
    },
  };
}

export function expectReordered(
  input: string,
  expected: string,
  sortImports: ConstructorParameters<typeof ImportSorter>[0],
  sortElements: ConstructorParameters<typeof ImportSorter>[1] = [],
  separators: ConstructorParameters<typeof ImportSeparator>[0] = [],
): void {
  const { sourceFile, imports } = parseImports(input);
  const sorted = new ImportSorter(sortImports, sortElements).sort(imports);
  const separated = new ImportSeparator(separators).insertSeparator(sorted);
  stdExpect(new ImportIntegrator().integrate(sourceFile, separated)).toBe(
    expected,
  );
}

// Compare declaration order without formatting the imports or inserting groups.
export function expectImportOrder(
  input: string,
  expected: string,
  comparator: (a: Import, b: Import) => number,
): void {
  const imports = parseImports(input).imports;
  const expectedImports = parseImports(expected).imports;
  stdExpect(imports).toHaveLength(expectedImports.length);
  new ImportSorter([comparator], []).sort(imports);
  stdExpect(
    imports.map((imported) => input.slice(imported.start, imported.end)),
  ).toEqual(
    expectedImports.map((imported) =>
      expected.slice(imported.start, imported.end)
    ),
  );
}

export function expectElementOrder(
  input: string,
  expected: string,
  comparator: (a: ImportElement, b: ImportElement) => number,
): void {
  expectReordered(input, expected, [], [comparator]);
}
