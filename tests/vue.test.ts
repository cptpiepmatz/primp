import { expect } from "@std/expect";
import { fromFileUrl, join } from "@std/path";

import {
  defaultConfig,
  extractSource,
  FileManager,
  formatImports,
  jsExtractor,
  tsExtractor,
} from "@primp/primp";
import { main } from "@primp/primp/cli";
import { sourceName } from "@primp/primp/rules/imports";
import { extractVueScripts, vueExtractor } from "@primp/vue";

const vueConfig = { extractors: [vueExtractor] };

// Indented Vue fixtures with a single final newline.
function vue(strings: TemplateStringsArray): string {
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

Deno.test("Vue extracts script slices and primp formats them without touching other blocks", () => {
  const input = vue`
    <template><div>{{ message }}</div></template>
    <script lang="ts">
    import z from "z";
    import a from "a";
    const message = z + a;
    </script>
    <script setup lang="ts">
    import y from "y";
    import x from "x";
    </script>
    <style scoped>.test { color: red; }</style>
  `;
  const expected = vue`
    <template><div>{{ message }}</div></template>
    <script lang="ts">
    import a from "a";
    import z from "z";
    const message = z + a;
    </script>
    <script setup lang="ts">
    import x from "x";
    import y from "y";
    </script>
    <style scoped>.test { color: red; }</style>
  `;
  const slices = extractVueScripts(input);
  expect(slices).toHaveLength(2);
  for (const slice of slices) {
    expect(input.slice(slice.start, slice.end)).toBe(slice.content);
  }
  expect(formatImports(input, vueConfig, "component.vue")).toBe(expected);
  expect(formatImports(expected, vueConfig, "component.vue")).toBe(expected);
});

Deno.test("primp defaults to a whole-file slice and uses configured extractors", () => {
  const input = 'import b from "b";\nimport a from "a";\n';
  expect(extractSource(input, "input.ts")).toEqual([{
    start: 0,
    end: input.length,
    content: input,
  }]);
  expect(defaultConfig.extractors[0]).toBe(tsExtractor);
  expect(tsExtractor.extract(input, "input.ts"))
    .toEqual(extractSource(input, "input.ts"));
  expect(formatImports(input)).toBe('import a from "a";\nimport b from "b";\n');
  expect(formatImports(input, { extractors: [jsExtractor] }, "input.js"))
    .toBe('import a from "a";\nimport b from "b";\n');
  expect(formatImports(input, {}, "input.js")).toBe(input);
  expect(formatImports(input, {}, "input.txt")).toBe(input);
  expect(
    () =>
      formatImports(input, {
        extractors: [{
          extensions: ".ts",
          extract: () => [{ start: -1, end: 3, content: input }],
        }],
      }),
  ).toThrow(RangeError);
  const embedded = "<code>placeholder</code>";
  expect(
    formatImports(embedded, {
      extractors: [{
        extensions: ".custom",
        extract: () => [{
          start: 6,
          end: 17,
          content: input,
        }],
      }],
    }, "input.custom"),
  ).toBe('<code>import a from "a";\nimport b from "b";\n</code>');
  expect(
    () =>
      formatImports(input, {
        extractors: [{
          extensions: ".ts",
          extract: () => [
            { start: 0, end: 12, content: input },
            { start: 10, end: input.length, content: input },
          ],
        }],
      }),
  ).toThrow(RangeError);
});

Deno.test("extractors select the first matching string, regex, or predicate", () => {
  const input = 'import b from "b";\nimport a from "a";\n';
  const pattern = /\.sfc$/gi;
  pattern.lastIndex = 2;
  const extractors = [
    { extensions: ".vue", extract: () => [] },
    { extensions: pattern, extract: () => [] },
    {
      extensions: (filename: string) => filename.endsWith(".custom"),
      extract: extractSource,
    },
  ];
  expect(formatImports(input, { extractors }, "component.vue")).toBe(input);
  expect(formatImports(input, { extractors }, "component.sfc")).toBe(input);
  expect(formatImports(input, { extractors }, "component.sfc")).toBe(input);
  expect(pattern.lastIndex).toBe(2);
  expect(formatImports(input, { extractors }, "component.custom"))
    .toBe('import a from "a";\nimport b from "b";\n');
  expect(formatImports(input, { extractors }, "component.ts")).toBe(input);
});

Deno.test("Vue extraction skips external and unsupported scripts", () => {
  const input = vue`
    <template><div /></template>
    <script setup lang="js">
    import a from "a";
    import b from "b";
    </script>
  `;
  expect(
    formatImports(input, {
      extractors: [vueExtractor],
      sortImports: [(a, b) => -sourceName(a, b)],
      separateBy: [],
      formatting: { quoteStyle: "single" },
    }, "component.vue"),
  ).toBe(vue`
    <template><div /></template>
    <script setup lang="js">
    import b from 'b';
    import a from 'a';
    </script>
  `);
  const external = '<script src="./external.ts"></script>';
  expect(extractVueScripts(external)).toEqual([]);
  expect(formatImports(external, vueConfig, "component.vue")).toBe(external);
  const coffee = '<script lang="coffee">\nimport b from "b"\n</script>';
  expect(extractVueScripts(coffee)).toEqual([]);
});

Deno.test("Vue leaves malformed scripts unchanged", () => {
  const input = '<script setup lang="ts">\nimport { from "broken";\n</script>';
  expect(formatImports(input, vueConfig, "component.vue")).toBe(input);
});

Deno.test("CLI discovers Vue files when the extractor is configured", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "primp-vue-" });
  try {
    const path = join(dir, "component.vue");
    Deno.writeTextFileSync(
      path,
      vue`
        <template><div /></template>
        <script setup lang="ts">
        import z from "z";
        import a from "a";
        </script>
      `,
    );
    const config = fromFileUrl(
      new URL("../examples/vue/primp.config.ts", import.meta.url),
    );
    await main(["--config", config, dir]);
    expect(Deno.readTextFileSync(path))
      .toMatch(/import a from "a";\nimport z from "z";/);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("CLI discovers files matched by regex and predicate extractors", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "primp-extractors-" });
  try {
    const config = join(dir, "primp.config.ts");
    Deno.writeTextFileSync(
      config,
      `export default {
      extractors: [
        { extensions: /\\.sfc$/i, extract: (source: string) => [{ start: 0, end: source.length, content: source }] },
        { extensions: (filename: string) => filename.endsWith(".custom"), extract: (source: string) => [{ start: 0, end: source.length, content: source }] },
      ],
    };`,
    );
    for (const name of ["component.sfc", "component.custom"]) {
      Deno.writeTextFileSync(
        join(dir, name),
        'import b from "b";\nimport a from "a";\n',
      );
    }
    await main(["--config", config, dir]);
    for (const name of ["component.sfc", "component.custom"]) {
      expect(Deno.readTextFileSync(join(dir, name)))
        .toBe('import a from "a";\nimport b from "b";\n');
    }
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("CLI skips unmatched explicit and recursive paths and honors the first extractor", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "primp-skip-" });
  try {
    const nested = join(dir, "nested");
    Deno.mkdirSync(nested);
    const original = 'import b from "b";\nimport a from "a";\n';
    for (const name of ["code.ts", "types.d.ts", "unknown.txt"]) {
      Deno.writeTextFileSync(join(nested, name), original);
    }
    const config = join(dir, "primp.config.ts");
    Deno.writeTextFileSync(
      config,
      `export default { extractors: [
      { extensions: (filename: string) => filename.endsWith(".ts") && !filename.endsWith(".d.ts"), extract: () => [] },
      { extensions: /\\.d\\.ts$/, extract: (source: string) => [{ start: 0, end: source.length, content: source }] },
    ] };`,
    );
    expect(FileManager.getFiles(join(nested, "unknown.txt"))).toEqual([]);
    expect(FileManager.getFiles(join(nested, "types.d.ts"))).toEqual([]);

    const output = join(dir, "out");
    await main([
      "--config",
      config,
      "--output",
      output,
      "-r",
      nested,
      join(nested, "unknown.txt"),
    ]);
    expect(Deno.readTextFileSync(join(output, "code.ts"))).toBe(original);
    expect(Deno.readTextFileSync(join(output, "types.d.ts")))
      .toBe('import a from "a";\nimport b from "b";\n');
    expect(() => Deno.statSync(join(output, "unknown.txt")))
      .toThrow(Deno.errors.NotFound);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});
