import { expect } from "@std/expect";
import { fromFileUrl, join } from "@std/path";

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
import { packageFirst } from "@primp/primp/rules/imports";

Deno.test("CLI uses one cwd config for multiple files and directories", async () => {
  const root = Deno.makeTempDirSync({ prefix: "primp-multi-" });
  const cwd = Deno.cwd();
  try {
    const first = join(root, "first");
    const second = join(root, "second");
    const output = join(root, "out");
    Deno.mkdirSync(first);
    Deno.mkdirSync(second);
    Deno.writeTextFileSync(
      join(root, "primp.config.ts"),
      'export default { formatting: { quoteStyle: "single" } };',
    );
    Deno.writeTextFileSync(
      join(first, "primp.config.ts"),
      'export default { formatting: { quoteStyle: "double" } };',
    );
    const original = 'import z from "z";\nimport a from "a";\n';
    const a = join(first, "same.ts");
    const b = join(first, "other.ts");
    const c = join(second, "same.ts");
    for (const path of [a, b, c]) Deno.writeTextFileSync(path, original);

    Deno.chdir(root);
    await main(["--output", output, a, b, c]);
    expect(Deno.readTextFileSync(join(output, "first", "same.ts")))
      .toBe("import a from 'a';\nimport z from 'z';\n");
    expect(Deno.readTextFileSync(join(output, "first", "other.ts")))
      .toBe("import a from 'a';\nimport z from 'z';\n");
    expect(Deno.readTextFileSync(join(output, "second", "same.ts")))
      .toBe("import a from 'a';\nimport z from 'z';\n");
    expect(Deno.readTextFileSync(a)).toBe(original);

    await main(["--output", output, first, a, second]);
    expect(Deno.readTextFileSync(join(output, "first", "same.ts")))
      .toBe("import a from 'a';\nimport z from 'z';\n");
    expect(Deno.readTextFileSync(join(output, "second", "same.ts")))
      .toBe("import a from 'a';\nimport z from 'z';\n");
    await main([
      "--config",
      join(first, "primp.config.ts"),
      "--output",
      output,
      a,
      c,
    ]);
    expect(Deno.readTextFileSync(join(output, "second", "same.ts")))
      .toBe('import a from "a";\nimport z from "z";\n');
  } finally {
    Deno.chdir(cwd);
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("directory scans include JavaScript only with its extractor", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "primp-js-scan-" });
  try {
    const nested = join(dir, "nested");
    Deno.mkdirSync(nested);
    const tsFile = join(dir, "a.ts");
    const jsFiles = ["b.js", "c.jsx", "d.mjs", "e.cjs"].map((name) =>
      join(nested, name)
    );
    const original = 'import z from "z";\nimport a from "a";\n';
    Deno.writeTextFileSync(tsFile, original);
    for (const file of jsFiles) Deno.writeTextFileSync(file, original);
    Deno.writeTextFileSync(join(nested, "ignore.txt"), original);
    expect(FileManager.getFiles(dir, true)).toEqual([tsFile]);
    const configPath = join(dir, "primp.config.ts");
    Deno.writeTextFileSync(configPath, "export default {};");
    await main(["--config", configPath, "-r", dir]);
    expect(Deno.readTextFileSync(tsFile))
      .toBe('import a from "a";\nimport z from "z";\n');
    for (const file of jsFiles) {
      expect(Deno.readTextFileSync(file)).toBe(original);
    }

    const jsConfigPath = join(dir, "js.config.ts");
    Deno.writeTextFileSync(
      jsConfigPath,
      `import { jsExtractor } from "${
        new URL("../packages/primp/mod.ts", import.meta.url).href
      }";\nexport default { extractors: [jsExtractor] };`,
    );
    const config = await ConfigHandler.load(jsConfigPath);
    expect(config.extractors).toHaveLength(1);
    await main(["--config", jsConfigPath, "-r", dir]);
    for (const file of jsFiles) {
      expect(Deno.readTextFileSync(file))
        .toBe('import a from "a";\nimport z from "z";\n');
    }
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("type specifiers, aliases, attributes and import-only files remain valid", () => {
  const text =
    `import {type User as Person, z as a} from 'pkg' with { type: 'json' };\n`;
  const { sourceFile, imports } = parseImports(text);
  expect(imports[0].attributes).toEqual({
    with: [{ key: { name: "type", type: "identifier" }, value: "'json'" }],
  });
  expect(imports[0].elements[0].isTypeOnly).toBe(true);
  expect(imports[0].elements[0].originalName).toBe("User");
  expect(
    new ImportIntegrator({ quoteStyle: "single" }).integrate(
      sourceFile,
      imports,
    ),
  ).toBe(
    `import { type User as Person, z as a } from 'pkg' with { type: 'json' };\n`,
  );
  expect(parseImports("const x = 1;\nimport z from 'z';").imports).toHaveLength(
    0,
  );
  const plain = parseImports('import plain from "plain";').imports[0];
  expect(plain.attributes).toEqual({});
  expect(plain.attributes.with).toBeUndefined();
  expect(plain.attributes.assert).toBeUndefined();
  const asserted = parseImports(
    'import data from "./data.json" assert { type: "json" };',
  ).imports[0];
  expect(asserted.attributes).toEqual({
    assert: [{ key: { name: "type", type: "identifier" }, value: '"json"' }],
  });
  expect(asserted.toString()).toBe(
    'import data from "./data.json" assert { type: "json" };',
  );
  const multiple = parseImports(
    `import data from "./data.json" with { type: "json", "mode": 'strict' };`,
  ).imports[0];
  expect(multiple.attributes).toEqual({
    with: [
      { key: { name: "type", type: "identifier" }, value: '"json"' },
      { key: { name: "mode", type: "literal" }, value: "'strict'" },
    ],
  });
  expect(multiple.toString()).toBe(
    `import data from "./data.json" with { type: "json", "mode": 'strict' };`,
  );
  expect(new ImportSeparator([]).insertSeparator([])).toHaveLength(0);
  const invalid = parseImports('import { from "broken";\n');
  expect(invalid.imports).toHaveLength(0);
  expect(new ImportIntegrator().integrate(invalid.sourceFile, invalid.imports))
    .toBe(invalid.sourceFile.text);
  const commented =
    `import z from "z"; // keep with import\nimport a from "a";\n`;
  const parsed = parseImports(commented);
  expect(
    new ImportIntegrator().integrate(
      parsed.sourceFile,
      parsed.imports.reverse(),
    ),
  ).toBe(commented);
});

Deno.test("declaration phase modifiers parse and render independently of inline type", () => {
  const text =
    'import type { A } from "types";\nimport defer * as ns from "lazy";\nimport { type B } from "mixed";\n';
  const { sourceFile, imports } = parseImports(text);
  expect(imports.map((imported) => imported.phaseModifier)).toEqual([
    "type",
    "defer",
    undefined,
  ]);
  expect(imports[2].elements[0].isTypeOnly).toBe(true);
  expect(imports.map((imported) => imported.toString())).toEqual([
    'import type { A } from "types";',
    'import defer * as ns from "lazy";',
    'import { type B } from "mixed";',
  ]);
  expect(new ImportIntegrator().integrate(sourceFile, imports)).toBe(text);
});

Deno.test("legacy formatting options remain available", () => {
  const long = parseImports(
    `import {alfa, bravo, charlie, delta, echo, foxtrot, golf, hotel, india} from "phonetic";\n`,
  );
  expect(
    new ImportIntegrator({ bracketIndent: 0, trailingComma: false }).integrate(
      long.sourceFile,
      long.imports,
    ),
  ).toBe(
    `import {\n  alfa,\n  bravo,\n  charlie,\n  delta,\n  echo,\n  foxtrot,\n  golf,\n  hotel,\n  india\n} from "phonetic";\n`,
  );
  const single = parseImports(
    `import SuperLongDefaultNameThatCannotFitWithinEightyColumnsWithItsSourcePath from "./path";\n`,
  );
  expect(
    new ImportIntegrator({ breakFrom: true }).integrate(
      single.sourceFile,
      single.imports,
    ),
  ).toMatch(/\n {2}from "\.\/path"/);
});

Deno.test("configuration discovery, file filtering and output newline retention", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "primp-" });
  try {
    Deno.mkdirSync(join(dir, "nested"));
    const configPath = join(dir, "primp.config.ts");
    Deno.writeTextFileSync(
      configPath,
      `export default { formatting: { quoteStyle: 'single' }, sortImports: [(a: { source: { name: string } }, b: { source: { name: string } }) => a.source.name.localeCompare(b.source.name)], sortImportElements: [], separateBy: [] };`,
    );
    const file = join(dir, "nested", "sample.ts");
    Deno.writeTextFileSync(
      file,
      `import b from "b";\r\nimport a from "a";\r\n`,
    );
    expect(new FileManager(file).imports.get(file)?.imports).toHaveLength(2);
    Deno.writeTextFileSync(join(dir, "nested", "ignore.txt"), "hi");
    expect(ConfigHandler.findConfig(file)).toBe(configPath);
    expect(FileManager.getFiles(join(dir, "nested"))).toEqual([file]);
    const output = join(dir, "out");
    await main(["--config", configPath, "--output", output, file]);
    expect(Deno.readTextFileSync(join(output, "sample.ts")))
      .toBe(`import a from 'a';\r\nimport b from 'b';\r\n`);
    expect(Deno.readTextFileSync(file)).toMatch(/import b/);
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("TypeScript config imports a comparator relative to its own file", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "primp-rules-" });
  try {
    const rulePath = join(dir, "reverse.mjs");
    Deno.writeTextFileSync(
      rulePath,
      "export default (a, b) => b.source.name.localeCompare(a.source.name);\n",
    );
    const configPath = join(dir, "primp.config.ts");
    Deno.writeTextFileSync(
      configPath,
      'import reverse from "./reverse.mjs";\nexport default { sortImports: [reverse], sortImportElements: [], separateBy: [] };\n',
    );
    const file = join(dir, "file.ts");
    Deno.writeTextFileSync(file, 'import a from "a";\nimport b from "b";\n');
    await main(["--config", configPath, file]);
    expect(Deno.readTextFileSync(file))
      .toBe('import b from "b";\nimport a from "a";\n');
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("inline TypeScript comparators and separators are used by the CLI", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "primp-inline-rule-" });
  try {
    const configPath = join(dir, "primp.config.ts");
    Deno.writeTextFileSync(
      configPath,
      "export default { sortImports: [(a: { source: { name: string } }, b: { source: { name: string } }) => b.source.name.localeCompare(a.source.name)], sortImportElements: [], separateBy: [(a: { source: { name: string } }, b: { source: { name: string } }) => a.source.name !== b.source.name] };",
    );
    const file = join(dir, "file.ts");
    Deno.writeTextFileSync(file, 'import a from "a";\nimport b from "b";\n');
    await main(["--config", configPath, file]);
    expect(Deno.readTextFileSync(file))
      .toBe('import b from "b";\n\nimport a from "a";\n');
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("primp configs are discovered and explicit paths work", async () => {
  const root = Deno.makeTempDirSync({ prefix: "primp-configs-" });
  try {
    for (const extension of ["ts", "mts", "js", "mjs"]) {
      const project = join(root, extension);
      Deno.mkdirSync(project);
      const configPath = join(project, `primp.config.${extension}`);
      Deno.writeTextFileSync(
        configPath,
        'export default { sortImports: [(a, b) => a.source.name.localeCompare(b.source.name)], formatting: { quoteStyle: "single" } };',
      );
      const source = join(project, "input.ts");
      Deno.writeTextFileSync(
        source,
        'import b from "b";\nimport a from "a";\n',
      );
      expect(ConfigHandler.findConfig(source)).toBe(configPath);
      await main(["--config", configPath, source]);
      expect(Deno.readTextFileSync(source))
        .toBe("import a from 'a';\nimport b from 'b';\n");
    }
    const custom = join(root, "custom.ts");
    Deno.writeTextFileSync(custom, "export default { sortImports: [] };");
    expect((await ConfigHandler.load(custom)).sortImports).toEqual([]);
    await expect(ConfigHandler.load(join(root, "missing.json"))).rejects
      .toThrow();
    const invalid = join(root, "invalid.ts");
    Deno.writeTextFileSync(invalid, "export default 42;");
    await expect(ConfigHandler.load(invalid))
      .rejects.toThrow(/default-export an object/);
  } finally {
    Deno.removeSync(root, { recursive: true });
  }
});

Deno.test("example config supports imported custom rules and defineConfig", async () => {
  const path = fromFileUrl(
    new URL("../examples/configs/primp.config.ts", import.meta.url),
  );
  const config = await ConfigHandler.load(path);
  expect(config.sortImports[1]).toBe(packageFirst);
  expect(config.formatting.trailingComma).toBe(false);
  expect(config.formatting.breakFrom).toBe(true);
  const imports =
    parseImports('import plain from "plain";\nimport js from "ends.js";')
      .imports;
  new ImportSorter([config.sortImports[2]], []).sort(imports);
  expect(imports[0].source.name).toBe("ends.js");
  expect(defineConfig({ sortImports: [] })).toEqual({ sortImports: [] });
});
