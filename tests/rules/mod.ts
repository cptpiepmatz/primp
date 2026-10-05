import {
  ImportIntegrator,
  ImportSeparator,
  ImportSorter,
  parseImports,
} from "@primp/primp";
import { expect as stdExpect } from "@std/expect";

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
    viaRules({
      sortImports = [],
      sortImportElements = [],
      separateBy = [],
      formatting,
    }: {
      sortImports?: ConstructorParameters<typeof ImportSorter>[0];
      sortImportElements?: ConstructorParameters<typeof ImportSorter>[1];
      separateBy?: ConstructorParameters<typeof ImportSeparator>[0];
      formatting?: ConstructorParameters<typeof ImportIntegrator>[0];
    }) {
      const { sourceFile, imports } = parseImports(input);
      const sorted = new ImportSorter(sortImports, sortImportElements).sort(
        imports,
      );
      const separated = new ImportSeparator(separateBy).insertSeparator(sorted);
      return stdExpect(
        new ImportIntegrator(formatting).integrate(sourceFile, separated),
      );
    },
  };
}
