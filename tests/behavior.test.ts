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
  builtin,
  ConfigHandler,
  FileManager,
  ImportIntegrator,
  ImportSeparator,
  ImportSorter,
  loadRules,
  parseImports,
} from "../mod.ts";
import type { Import } from "../mod.ts";
import { main, parseCliArgs } from "../cli.ts";

Deno.test("yargs handles short aliases, grouped switches, equals syntax, and errors", () => {
  assert.deepEqual(
    parseCliArgs([
      "-rw",
      "--output=out",
      "--config",
      "primp.json",
      "src",
    ]),
    {
      input: "src",
      recursive: true,
      watch: true,
      output: "out",
      config: "primp.json",
    },
  );
  assert.equal(parseCliArgs(["--", "-file.ts"])?.input, "-file.ts");
  assert.throws(() => parseCliArgs(["--nonsense", "src"]), /Unknown argument/);
  assert.throws(
    () => parseCliArgs(["-t", "tsconfig.json", "src"]),
    /Unknown argument/,
  );
  assert.throws(
    () => parseCliArgs(["--tsconfig=tsconfig.json", "src"]),
    /Unknown argument/,
  );
  assert.throws(
    () => parseCliArgs(["src", "--output"]),
    /requires an argument|Not enough arguments|Missing required argument/,
  );
  assert.throws(() => parseCliArgs(["a.ts", "b.ts"]), /exactly one/);
});

Deno.test("defaults restore legacy declaration sorting and grouping with Deno-compatible specifiers", () => {
  const text =
    `// header\nimport local from "./z";\nimport {Zoo, a, Alpha} from "beta";\nimport "polyfill";\nimport * as ns from "alpha";\n\nrun();\n`;
  const { sourceFile, imports } = parseImports(text);
  const config = new ConfigHandler();
  const sorted = new ImportSorter(config.sortImports, config.sortImportElements)
    .sort(imports);
  const result = new ImportIntegrator(config.formatting).integrate(
    sourceFile,
    new ImportSeparator(config.separateBy).insertSeparator(sorted),
  );
  assert.equal(
    result,
    `// header\nimport { a, Alpha, Zoo } from "beta";\n\nimport * as ns from "alpha";\n\nimport local from "./z";\n\nimport "polyfill";\n\nrun();\n`,
  );
  assert.deepEqual(config.sortImports, [
    "!sideEffect",
    "sourceType",
    "!namespacePresence",
    "pathName",
    "sourceName",
  ]);
  assert.deepEqual(config.separateBy, [
    "unequalSideEffectUse",
    "unequalPackageState",
    "unequalNamespaceUse",
  ]);
});

Deno.test("type specifiers, aliases, attributes and import-only files remain valid", () => {
  const text =
    `import {type User as Person, z as a} from 'pkg' with { type: 'json' };\n`;
  const { sourceFile, imports } = parseImports(text);
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

Deno.test("default import order, Deno-style specifiers and multiline commas", () => {
  const input =
    `import {z as a, a as z, type Zebra, type Beta, b, B, A} from 'pkg';\n\nimport {} from 'x';\nimport {alfa, bravo, charlie, delta, echo, foxtrot, golf, hotel, india} from 'phonetic';\n`;
  const { sourceFile, imports } = parseImports(input);
  const config = new ConfigHandler();
  const result = new ImportIntegrator(config.formatting).integrate(
    sourceFile,
    new ImportSeparator(config.separateBy).insertSeparator(
      new ImportSorter(config.sortImports, config.sortImportElements).sort(
        imports,
      ),
    ),
  );
  assert.equal(
    result,
    `import {\n  alfa,\n  bravo,\n  charlie,\n  delta,\n  echo,\n  foxtrot,\n  golf,\n  hotel,\n  india,\n} from "phonetic";\nimport { A, a as z, B, b, type Beta, z as a, type Zebra } from "pkg";\n\nimport {} from "x";\n`,
  );
});

Deno.test("custom grouping and legacy formatting remain available", () => {
  const { sourceFile, imports } = parseImports(
    `import a from "./a";\nimport b from "b";\n`,
  );
  const sorted = new ImportSorter(["sourceType"], []).sort(imports);
  const grouped = new ImportSeparator(["unequalPackageState"]).insertSeparator(
    sorted,
  );
  assert.equal(
    new ImportIntegrator().integrate(sourceFile, grouped),
    `import b from "b";\n\nimport a from "./a";\n`,
  );
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

Deno.test("inverted rules, custom rules and invalid rule names", () => {
  const { imports } = parseImports(`import a from "a";\nimport b from "b";`);
  new ImportSorter(["!sourceName"], [], {}).sort(imports);
  assert.equal(imports[0].source.name, "b");
  new ImportSorter(["reverse"], [], {
    reverse: (a: Import, b: Import) =>
      b.source.name.localeCompare(a.source.name),
  }).sort(imports);
  assert.equal(imports[0].source.name, "b");
  assert.throws(() => new ImportSorter(["missing"], []), /Unknown rule/);
  const relativeImports =
    parseImports(`import a from "./x";\nimport b from "./x/y";`).imports;
  assert.equal(
    builtin.compareImports.pathDepth(relativeImports[0], relativeImports[1]),
    -1,
  );
});

Deno.test("configuration discovery, validation, file filtering and output newline retention", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-"));
  try {
    mkdirSync(join(dir, "nested"));
    const configPath = join(dir, "primp.json5");
    writeFileSync(
      configPath,
      `{ formatting: { quoteStyle: 'single' }, sortImports: ['sourceName'], sortImportElements: [], separateBy: [] }`,
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
    writeFileSync(configPath, `{ sortImports: 42 }`);
    assert.throws(() => new ConfigHandler(configPath), /array/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

Deno.test("YAML config and ESM comparator loaded relative to config", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-rules-"));
  try {
    const rulePath = join(dir, "reverse.mjs");
    writeFileSync(
      rulePath,
      "export default (a, b) => b.source.name.localeCompare(a.source.name);\n",
    );
    const configPath = join(dir, "primp.yaml");
    writeFileSync(
      configPath,
      "sortImports: [reverse]\nsortImportElements: []\nseparateBy: []\nrequire:\n  reverse: ./reverse.mjs\n",
    );
    const file = join(dir, "file.ts");
    writeFileSync(file, 'import a from "a";\nimport b from "b";\n');
    await main([file]);
    assert.equal(
      readFileSync(file, "utf8"),
      'import b from "b";\nimport a from "a";\n',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

Deno.test("JSONC and TOML configs are discovered and used by the CLI", async () => {
  const root = mkdtempSync(join(tmpdir(), "primp-formats-"));
  try {
    for (
      const [extension, content] of [
        [
          "jsonc",
          '{ // comment\n "sortImports": ["sourceName",], "formatting": {"quoteStyle": "single",}, }',
        ],
        [
          "toml",
          'sortImports = ["sourceName"]\n[formatting]\nquoteStyle = "single"\n',
        ],
      ]
    ) {
      const project = join(root, extension);
      mkdirSync(project);
      const configPath = join(project, `primp.${extension}`);
      writeFileSync(configPath, content);
      const source = join(project, "input.ts");
      writeFileSync(source, 'import b from "b";\nimport a from "a";\n');
      assert.equal(ConfigHandler.isSupportedConfigFile(configPath), true);
      assert.equal(ConfigHandler.findConfig(source), configPath);
      await main([source]);
      assert.equal(
        readFileSync(source, "utf8"),
        "import a from 'a';\nimport b from 'b';\n",
      );
      writeFileSync(
        configPath,
        extension === "toml"
          ? 'sortImports = ["sourceName"'
          : '{ "sortImports": [ }',
      );
      assert.throws(() => new ConfigHandler(configPath));
    }
    const custom = join(root, "custom.toml");
    writeFileSync(custom, 'sortImports = ["sourceName"]\n');
    assert.equal(ConfigHandler.isSupportedConfigFile(custom), false);
    assert.deepEqual(new ConfigHandler(custom).sortImports, ["sourceName"]);
    assert.equal(ConfigHandler.isSupportedConfigFile("primp.yaml"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

Deno.test("all example config formats specify the same rules and formatting", async () => {
  const examples = ["json", "jsonc", "json5", "yml", "toml"].map(
    (extension) => {
      const path = fileURLToPath(
        new URL(`../examples/configs/primp.${extension}`, import.meta.url),
      );
      return { path, config: new ConfigHandler(path) };
    },
  );
  const expected = examples[0].config;
  assert.equal(expected.sortImports[0], "!sideEffect");
  assert.equal(expected.formatting.trailingComma, false);
  assert.equal(expected.formatting.breakFrom, true);
  for (const { path, config } of examples) {
    assert.deepEqual(config, expected, path);
    const rules = await loadRules(config, path);
    const imports =
      parseImports('import plain from "plain";\nimport js from "ends.js";')
        .imports;
    new ImportSorter(["dotJSFirst"], [], rules).sort(imports);
    assert.equal(imports[0].source.name, "ends.js", path);
  }
  const dir = mkdtempSync(join(tmpdir(), "primp-config-"));
  try {
    const path = join(dir, "primp.json");
    writeFileSync(path, '{"formatting":{"trailingComma":"no"}}');
    assert.throws(
      () => new ConfigHandler(path),
      /trailingComma must be a boolean/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
