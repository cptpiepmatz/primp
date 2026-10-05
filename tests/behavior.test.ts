import assert from "node:assert/strict";
import {
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
  ConfigHandler,
  defineConfig,
  FileManager,
  ImportIntegrator,
  ImportSeparator,
  ImportSorter,
  parseImports,
} from "@primp/primp";
import { main } from "@primp/primp/cli";
import { sourceType } from "@primp/primp/rules/imports";

Deno.test("CLI uses one cwd config for multiple files and directories", async () => {
  const root = mkdtempSync(join(tmpdir(), "primp-multi-"));
  const cwd = Deno.cwd();
  try {
    const first = join(root, "first");
    const second = join(root, "second");
    const output = join(root, "out");
    mkdirSync(first);
    mkdirSync(second);
    writeFileSync(
      join(root, "primp.config.ts"),
      'export default { formatting: { quoteStyle: "single" } };',
    );
    writeFileSync(
      join(first, "primp.config.ts"),
      'export default { formatting: { quoteStyle: "double" } };',
    );
    const original = 'import z from "z";\nimport a from "a";\n';
    const a = join(first, "same.ts");
    const b = join(first, "other.ts");
    const c = join(second, "same.ts");
    for (const path of [a, b, c]) writeFileSync(path, original);

    Deno.chdir(root);
    await main(["--output", output, a, b, c]);
    assert.equal(
      readFileSync(join(output, "first", "same.ts"), "utf8"),
      "import a from 'a';\nimport z from 'z';\n",
    );
    assert.equal(
      readFileSync(join(output, "first", "other.ts"), "utf8"),
      "import a from 'a';\nimport z from 'z';\n",
    );
    assert.equal(
      readFileSync(join(output, "second", "same.ts"), "utf8"),
      "import a from 'a';\nimport z from 'z';\n",
    );
    assert.equal(readFileSync(a, "utf8"), original);

    await main(["--output", output, first, a, second]);
    assert.equal(
      readFileSync(join(output, "first", "same.ts"), "utf8"),
      "import a from 'a';\nimport z from 'z';\n",
    );
    assert.equal(
      readFileSync(join(output, "second", "same.ts"), "utf8"),
      "import a from 'a';\nimport z from 'z';\n",
    );
    await main([
      "--config",
      join(first, "primp.config.ts"),
      "--output",
      output,
      a,
      c,
    ]);
    assert.equal(
      readFileSync(join(output, "second", "same.ts"), "utf8"),
      'import a from "a";\nimport z from "z";\n',
    );
  } finally {
    Deno.chdir(cwd);
    rmSync(root, { recursive: true, force: true });
  }
});

Deno.test("directory scans include JavaScript only with its extractor", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-js-scan-"));
  try {
    const nested = join(dir, "nested");
    mkdirSync(nested);
    const tsFile = join(dir, "a.ts");
    const jsFiles = ["b.js", "c.jsx", "d.mjs", "e.cjs"].map((name) =>
      join(nested, name)
    );
    const original = 'import z from "z";\nimport a from "a";\n';
    writeFileSync(tsFile, original);
    for (const file of jsFiles) writeFileSync(file, original);
    writeFileSync(join(nested, "ignore.txt"), original);
    assert.deepEqual(FileManager.getFiles(dir, true), [tsFile]);
    const configPath = join(dir, "primp.config.ts");
    writeFileSync(configPath, "export default {};");
    await main(["--config", configPath, "-r", dir]);
    assert.equal(
      readFileSync(tsFile, "utf8"),
      'import a from "a";\nimport z from "z";\n',
    );
    for (const file of jsFiles) {
      assert.equal(readFileSync(file, "utf8"), original);
    }

    const jsConfigPath = join(dir, "js.config.ts");
    writeFileSync(
      jsConfigPath,
      `import { jsExtractor } from "${
        new URL("../packages/primp/mod.ts", import.meta.url).href
      }";\nexport default { extractors: [jsExtractor] };`,
    );
    const config = await ConfigHandler.load(jsConfigPath);
    assert.equal(config.extractors.length, 1);
    await main(["--config", jsConfigPath, "-r", dir]);
    for (const file of jsFiles) {
      assert.equal(
        readFileSync(file, "utf8"),
        'import a from "a";\nimport z from "z";\n',
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

Deno.test("type specifiers, aliases, attributes and import-only files remain valid", () => {
  const text =
    `import {type User as Person, z as a} from 'pkg' with { type: 'json' };\n`;
  const { sourceFile, imports } = parseImports(text);
  assert.deepEqual(imports[0].attributes, {
    with: [{ key: { name: "type", type: "identifier" }, value: "'json'" }],
  });
  assert.equal(imports[0].elements[0].isTypeOnly, true);
  assert.equal(imports[0].elements[0].originalName, "User");
  assert.equal(
    new ImportIntegrator({ quoteStyle: "single" }).integrate(
      sourceFile,
      imports,
    ),
    `import { type User as Person, z as a } from 'pkg' with { type: 'json' };\n`,
  );
  assert.equal(
    parseImports("const x = 1;\nimport z from 'z';").imports.length,
    0,
  );
  const plain = parseImports('import plain from "plain";').imports[0];
  assert.deepEqual(plain.attributes, {});
  assert.equal(plain.attributes.with, undefined);
  assert.equal(plain.attributes.assert, undefined);
  const asserted = parseImports(
    'import data from "./data.json" assert { type: "json" };',
  ).imports[0];
  assert.deepEqual(asserted.attributes, {
    assert: [{ key: { name: "type", type: "identifier" }, value: '"json"' }],
  });
  assert.equal(
    asserted.toString(),
    'import data from "./data.json" assert { type: "json" };',
  );
  const multiple = parseImports(
    `import data from "./data.json" with { type: "json", "mode": 'strict' };`,
  ).imports[0];
  assert.deepEqual(multiple.attributes, {
    with: [
      { key: { name: "type", type: "identifier" }, value: '"json"' },
      { key: { name: "mode", type: "stringLiteral" }, value: "'strict'" },
    ],
  });
  assert.equal(
    multiple.toString(),
    `import data from "./data.json" with { type: "json", "mode": 'strict' };`,
  );
  assert.equal(new ImportSeparator([]).insertSeparator([]).length, 0);
  const invalid = parseImports('import { from "broken";\n');
  assert.equal(invalid.imports.length, 0);
  assert.equal(
    new ImportIntegrator().integrate(invalid.sourceFile, invalid.imports),
    invalid.sourceFile.text,
  );
  const commented =
    `import z from "z"; // keep with import\nimport a from "a";\n`;
  const parsed = parseImports(commented);
  assert.equal(
    new ImportIntegrator().integrate(
      parsed.sourceFile,
      parsed.imports.reverse(),
    ),
    commented,
  );
});

Deno.test("legacy formatting options remain available", () => {
  const long = parseImports(
    `import {alfa, bravo, charlie, delta, echo, foxtrot, golf, hotel, india} from "phonetic";\n`,
  );
  assert.equal(
    new ImportIntegrator({ bracketIndent: 0, trailingComma: false }).integrate(
      long.sourceFile,
      long.imports,
    ),
    `import {\n  alfa,\n  bravo,\n  charlie,\n  delta,\n  echo,\n  foxtrot,\n  golf,\n  hotel,\n  india\n} from "phonetic";\n`,
  );
  const single = parseImports(
    `import SuperLongDefaultNameThatCannotFitWithinEightyColumnsWithItsSourcePath from "./path";\n`,
  );
  assert.match(
    new ImportIntegrator({ breakFrom: true }).integrate(
      single.sourceFile,
      single.imports,
    ),
    /\n {2}from "\.\/path"/,
  );
});

Deno.test("configuration discovery, file filtering and output newline retention", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-"));
  try {
    mkdirSync(join(dir, "nested"));
    const configPath = join(dir, "primp.config.ts");
    writeFileSync(
      configPath,
      `export default { formatting: { quoteStyle: 'single' }, sortImports: [(a: { source: { name: string } }, b: { source: { name: string } }) => a.source.name.localeCompare(b.source.name)], sortImportElements: [], separateBy: [] };`,
    );
    const file = join(dir, "nested", "sample.ts");
    writeFileSync(file, `import b from "b";\r\nimport a from "a";\r\n`);
    assert.equal(new FileManager(file).imports.get(file)?.imports.length, 2);
    writeFileSync(join(dir, "nested", "ignore.txt"), "hi");
    assert.equal(ConfigHandler.findConfig(file), configPath);
    assert.deepEqual(FileManager.getFiles(join(dir, "nested")), [file]);
    const output = join(dir, "out");
    await main(["--config", configPath, "--output", output, file]);
    assert.equal(
      readFileSync(join(output, "sample.ts"), "utf8"),
      `import a from 'a';\r\nimport b from 'b';\r\n`,
    );
    assert.match(readFileSync(file, "utf8"), /import b/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

Deno.test("TypeScript config imports a comparator relative to its own file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-rules-"));
  try {
    const rulePath = join(dir, "reverse.mjs");
    writeFileSync(
      rulePath,
      "export default (a, b) => b.source.name.localeCompare(a.source.name);\n",
    );
    const configPath = join(dir, "primp.config.ts");
    writeFileSync(
      configPath,
      'import reverse from "./reverse.mjs";\nexport default { sortImports: [reverse], sortImportElements: [], separateBy: [] };\n',
    );
    const file = join(dir, "file.ts");
    writeFileSync(file, 'import a from "a";\nimport b from "b";\n');
    await main(["--config", configPath, file]);
    assert.equal(
      readFileSync(file, "utf8"),
      'import b from "b";\nimport a from "a";\n',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

Deno.test("inline TypeScript comparators and separators are used by the CLI", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-inline-rule-"));
  try {
    const configPath = join(dir, "primp.config.ts");
    writeFileSync(
      configPath,
      "export default { sortImports: [(a: { source: { name: string } }, b: { source: { name: string } }) => b.source.name.localeCompare(a.source.name)], sortImportElements: [], separateBy: [(a: { source: { name: string } }, b: { source: { name: string } }) => a.source.name !== b.source.name] };",
    );
    const file = join(dir, "file.ts");
    writeFileSync(file, 'import a from "a";\nimport b from "b";\n');
    await main(["--config", configPath, file]);
    assert.equal(
      readFileSync(file, "utf8"),
      'import b from "b";\n\nimport a from "a";\n',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

Deno.test("primp configs are discovered and explicit paths work", async () => {
  const root = mkdtempSync(join(tmpdir(), "primp-configs-"));
  try {
    for (const extension of ["ts", "mts", "js", "mjs"]) {
      const project = join(root, extension);
      mkdirSync(project);
      const configPath = join(project, `primp.config.${extension}`);
      writeFileSync(
        configPath,
        'export default { sortImports: [(a, b) => a.source.name.localeCompare(b.source.name)], formatting: { quoteStyle: "single" } };',
      );
      const source = join(project, "input.ts");
      writeFileSync(source, 'import b from "b";\nimport a from "a";\n');
      assert.equal(ConfigHandler.findConfig(source), configPath);
      await main(["--config", configPath, source]);
      assert.equal(
        readFileSync(source, "utf8"),
        "import a from 'a';\nimport b from 'b';\n",
      );
    }
    const custom = join(root, "custom.ts");
    writeFileSync(custom, "export default { sortImports: [] };");
    assert.deepEqual((await ConfigHandler.load(custom)).sortImports, []);
    await assert.rejects(ConfigHandler.load(join(root, "missing.json")));
    const invalid = join(root, "invalid.ts");
    writeFileSync(invalid, "export default 42;");
    await assert.rejects(
      ConfigHandler.load(invalid),
      /default-export an object/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

Deno.test("example config supports imported custom rules and defineConfig", async () => {
  const path = fileURLToPath(
    new URL("../examples/configs/primp.config.ts", import.meta.url),
  );
  const config = await ConfigHandler.load(path);
  assert.equal(config.sortImports[1], sourceType);
  assert.equal(config.formatting.trailingComma, false);
  assert.equal(config.formatting.breakFrom, true);
  const imports =
    parseImports('import plain from "plain";\nimport js from "ends.js";')
      .imports;
  new ImportSorter([config.sortImports[2]], []).sort(imports);
  assert.equal(imports[0].source.name, "ends.js");
  assert.deepEqual(defineConfig({ sortImports: [] }), { sortImports: [] });
});
