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
  defineConfig,
  FileManager,
  ImportIntegrator,
  ImportSeparator,
  ImportSorter,
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
      "primp.config.ts",
      "src",
    ]),
    {
      inputs: ["src"],
      recursive: true,
      includeJs: undefined,
      watch: true,
      output: "out",
      config: "primp.config.ts",
    },
  );
  assert.deepEqual(parseCliArgs(["--", "-file.ts"])?.inputs, ["-file.ts"]);
  assert.deepEqual(parseCliArgs(["a.ts", "b.ts"])?.inputs, [
    "a.ts",
    "b.ts",
  ]);
  assert.equal(parseCliArgs(["--include-js", "src"])?.includeJs, true);
  assert.equal(parseCliArgs(["--include-js=false", "src"])?.includeJs, false);
  assert.throws(
    () => parseCliArgs(["--no-include-js", "src"]),
    /Unknown argument/,
  );
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
  assert.throws(() => parseCliArgs([]), /at least one/);
});

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

Deno.test("defaults restore legacy declaration sorting and grouping with Deno-compatible specifiers", () => {
  const text =
    `// header\nimport local from "./z";\nimport {Zoo, a, Alpha} from "beta";\nimport "polyfill";\nimport * as ns from "alpha";\n\nrun();\n`;
  const { sourceFile, imports } = parseImports(text);
  const config = new ConfigHandler();
  assert.equal(config.includeJs, false);
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

Deno.test("directory scans include JavaScript only when enabled, with CLI overrides", async () => {
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
    assert.deepEqual(FileManager.getFiles(dir, true, true), [
      tsFile,
      ...jsFiles,
    ]);

    const configPath = join(dir, "primp.config.ts");
    writeFileSync(configPath, "export default { includeJs: true };");
    assert.equal((await ConfigHandler.load(configPath)).includeJs, true);
    await main(["--config", configPath, "--include-js=false", "-r", dir]);
    assert.equal(
      readFileSync(tsFile, "utf8"),
      'import a from "a";\nimport z from "z";\n',
    );
    for (const file of jsFiles) {
      assert.equal(readFileSync(file, "utf8"), original);
    }

    await main(["--config", configPath, "-r", dir]);
    for (const file of jsFiles) {
      assert.equal(
        readFileSync(file, "utf8"),
        'import a from "a";\nimport z from "z";\n',
      );
      writeFileSync(file, original);
    }
    writeFileSync(configPath, "export default { includeJs: false };");
    await main(["--config", configPath, "--include-js", "-r", dir]);
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

Deno.test("opt-in node: rules prioritize and separate built-in imports", () => {
  const { sourceFile, imports } = parseImports(
    'import local from "./local";\nimport pkg from "pkg";\nimport path from "node:path";\nimport fs from "node:fs";\n',
  );
  const config = new ConfigHandler();
  assert.equal(config.sortImports.includes("nodePrefix"), false);
  assert.equal(config.separateBy.includes("unequalNodePrefix"), false);
  assert.equal(builtin.compareImports.nodePrefix(imports[2], imports[3]), 0);
  assert.equal(builtin.compareImports.nodePrefix(imports[0], imports[1]), 0);
  assert.equal(
    builtin.separateBy.unequalNodePrefix(imports[2], imports[3]),
    false,
  );
  assert.equal(
    builtin.separateBy.unequalNodePrefix(imports[1], imports[2]),
    true,
  );
  const sorted = new ImportSorter(
    ["nodePrefix", ...config.sortImports],
    config.sortImportElements,
  ).sort(imports);
  const separated = new ImportSeparator([
    "unequalNodePrefix",
    ...config.separateBy,
  ]).insertSeparator(sorted);
  assert.equal(
    new ImportIntegrator(config.formatting).integrate(sourceFile, separated),
    'import fs from "node:fs";\nimport path from "node:path";\n\nimport pkg from "pkg";\n\nimport local from "./local";\n',
  );
});

Deno.test("configuration discovery, file filtering and output newline retention", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-"));
  try {
    mkdirSync(join(dir, "nested"));
    const configPath = join(dir, "primp.config.ts");
    writeFileSync(
      configPath,
      `export default { formatting: { quoteStyle: 'single' }, sortImports: ['sourceName'], sortImportElements: [], separateBy: [] };`,
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
      'import reverse from "./reverse.mjs";\nexport default { sortImports: ["reverse"], sortImportElements: [], separateBy: [], rules: { reverse } };\n',
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

Deno.test("inline TypeScript rules are passed to the sorter", async () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-inline-rule-"));
  try {
    const configPath = join(dir, "primp.config.ts");
    writeFileSync(
      configPath,
      'export default { sortImports: ["reverse"], sortImportElements: [], separateBy: [], rules: { reverse: (a: { source: { name: string } }, b: { source: { name: string } }) => b.source.name.localeCompare(a.source.name) } };',
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

Deno.test("TypeScript configs are discovered and explicit paths work", async () => {
  const root = mkdtempSync(join(tmpdir(), "primp-configs-"));
  try {
    for (const name of ["primp", "pretty-ts-imports", "prettytsimports"]) {
      const project = join(root, name);
      mkdirSync(project);
      const configPath = join(project, `${name}.config.ts`);
      writeFileSync(
        configPath,
        'export default { sortImports: ["sourceName"], formatting: { quoteStyle: "single" } };',
      );
      const source = join(project, "input.ts");
      writeFileSync(source, 'import b from "b";\nimport a from "a";\n');
      assert.equal(ConfigHandler.isSupportedConfigFile(configPath), true);
      assert.equal(ConfigHandler.findConfig(source), configPath);
      await main(["--config", configPath, source]);
      assert.equal(
        readFileSync(source, "utf8"),
        "import a from 'a';\nimport b from 'b';\n",
      );
    }
    const custom = join(root, "custom.ts");
    writeFileSync(custom, 'export default { sortImports: ["sourceName"] };');
    assert.equal(ConfigHandler.isSupportedConfigFile(custom), false);
    assert.deepEqual((await ConfigHandler.load(custom)).sortImports, [
      "sourceName",
    ]);
    assert.equal(ConfigHandler.isSupportedConfigFile("primp.config.ts"), true);
    assert.equal(ConfigHandler.isSupportedConfigFile("primp.json"), false);
    await assert.rejects(
      ConfigHandler.load(join(root, "missing.json")),
      /Unsupported/,
    );
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
  assert.equal(config.sortImports[0], "!sideEffect");
  assert.equal(config.formatting.trailingComma, false);
  assert.equal(config.formatting.breakFrom, true);
  const imports =
    parseImports('import plain from "plain";\nimport js from "ends.js";')
      .imports;
  new ImportSorter(["dotJSFirst"], [], config.rules).sort(imports);
  assert.equal(imports[0].source.name, "ends.js");
  assert.deepEqual(defineConfig({ sortImports: [] }), { sortImports: [] });
});
