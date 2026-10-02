import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

Deno.test("Vue extracts script slices and primp formats them without touching other blocks", () => {
  const input = `<template><div>{{ message }}</div></template>
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
  const expected = `<template><div>{{ message }}</div></template>
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
  assert.equal(slices.length, 2);
  for (const slice of slices) {
    assert.equal(input.slice(slice.start, slice.end), slice.content);
  }
  assert.equal(formatImports(input, vueConfig, "component.vue"), expected);
  assert.equal(formatImports(expected, vueConfig, "component.vue"), expected);
});

Deno.test("primp defaults to a whole-file slice and uses configured extractors", () => {
  const input = 'import b from "b";\nimport a from "a";\n';
  assert.deepEqual(extractSource(input, "input.ts"), [{
    start: 0,
    end: input.length,
    content: input,
  }]);
  assert.equal(defaultConfig.extractors[0], tsExtractor);
  assert.deepEqual(
    tsExtractor.extract(input, "input.ts"),
    extractSource(input, "input.ts"),
  );
  assert.equal(
    formatImports(input),
    'import a from "a";\nimport b from "b";\n',
  );
  assert.equal(
    formatImports(input, { extractors: [jsExtractor] }, "input.js"),
    'import a from "a";\nimport b from "b";\n',
  );
  assert.equal(formatImports(input, {}, "input.js"), input);
  assert.equal(formatImports(input, {}, "input.txt"), input);
  assert.throws(
    () =>
      formatImports(input, {
        extractors: [{
          extensions: ".ts",
          extract: () => [{ start: -1, end: 3, content: input }],
        }],
      }),
    RangeError,
  );
  const embedded = "<code>placeholder</code>";
  assert.equal(
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
    '<code>import a from "a";\nimport b from "b";\n</code>',
  );
  assert.throws(
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
    RangeError,
  );
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
  assert.equal(formatImports(input, { extractors }, "component.vue"), input);
  assert.equal(formatImports(input, { extractors }, "component.sfc"), input);
  assert.equal(formatImports(input, { extractors }, "component.sfc"), input);
  assert.equal(pattern.lastIndex, 2);
  assert.equal(
    formatImports(input, { extractors }, "component.custom"),
    'import a from "a";\nimport b from "b";\n',
  );
  assert.equal(
    formatImports(input, { extractors }, "component.ts"),
    'import a from "a";\nimport b from "b";\n',
  );
});

Deno.test("Vue extraction skips external and unsupported scripts", () => {
  const input = `<template><div /></template>
<script setup lang="js">
import a from "a";
import b from "b";
</script>
`;
  assert.equal(
    formatImports(input, {
      extractors: [vueExtractor],
      sortImports: [(a, b) => -sourceName(a, b)],
      separateBy: [],
      formatting: { quoteStyle: "single" },
    }, "component.vue"),
    `<template><div /></template>
<script setup lang="js">
import b from 'b';
import a from 'a';
</script>
`,
  );
  const external = '<script src="./external.ts"></script>';
  assert.deepEqual(extractVueScripts(external), []);
  assert.equal(formatImports(external, vueConfig, "component.vue"), external);
  const coffee = '<script lang="coffee">\nimport b from "b"\n</script>';
  assert.deepEqual(extractVueScripts(coffee), []);
});

Deno.test("Vue leaves malformed scripts unchanged", () => {
  const input = '<script setup lang="ts">\nimport { from "broken";\n</script>';
  assert.equal(formatImports(input, vueConfig, "component.vue"), input);
});

Deno.test("CLI discovers Vue files when the extractor is configured", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-vue-"));
  try {
    const path = join(dir, "component.vue");
    writeFileSync(
      path,
      '<template><div /></template>\n<script setup lang="ts">\nimport z from "z";\nimport a from "a";\n</script>\n',
    );
    const config = fileURLToPath(
      new URL("../examples/vue/primp.config.ts", import.meta.url),
    );
    await main(["--config", config, dir]);
    assert.match(
      readFileSync(path, "utf8"),
      /import a from "a";\nimport z from "z";/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

Deno.test("CLI discovers files matched by regex and predicate extractors", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-extractors-"));
  try {
    const config = join(dir, "primp.config.ts");
    writeFileSync(
      config,
      `export default {
      extractors: [
        { extensions: /\\.sfc$/i, extract: (source: string) => [{ start: 0, end: source.length, content: source }] },
        { extensions: (filename: string) => filename.endsWith(".custom"), extract: (source: string) => [{ start: 0, end: source.length, content: source }] },
      ],
    };`,
    );
    for (const name of ["component.sfc", "component.custom"]) {
      writeFileSync(
        join(dir, name),
        'import b from "b";\nimport a from "a";\n',
      );
    }
    await main(["--config", config, dir]);
    for (const name of ["component.sfc", "component.custom"]) {
      assert.equal(
        readFileSync(join(dir, name), "utf8"),
        'import a from "a";\nimport b from "b";\n',
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

Deno.test("CLI skips unmatched explicit and recursive paths and honors the first extractor", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-skip-"));
  try {
    const nested = join(dir, "nested");
    mkdirSync(nested);
    const original = 'import b from "b";\nimport a from "a";\n';
    for (const name of ["code.ts", "types.d.ts", "unknown.txt"]) {
      writeFileSync(join(nested, name), original);
    }
    const config = join(dir, "primp.config.ts");
    writeFileSync(
      config,
      `export default { extractors: [
      { extensions: (filename: string) => filename.endsWith(".ts") && !filename.endsWith(".d.ts"), extract: () => [] },
      { extensions: /\\.d\\.ts$/, extract: (source: string) => [{ start: 0, end: source.length, content: source }] },
    ] };`,
    );
    assert.deepEqual(FileManager.getFiles(join(nested, "unknown.txt")), []);
    assert.deepEqual(FileManager.getFiles(join(nested, "types.d.ts")), []);

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
    assert.equal(readFileSync(join(output, "code.ts"), "utf8"), original);
    assert.equal(
      readFileSync(join(output, "types.d.ts"), "utf8"),
      'import a from "a";\nimport b from "b";\n',
    );
    assert.equal(existsSync(join(output, "unknown.txt")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
