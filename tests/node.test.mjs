import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  ConfigHandler,
  ImportIntegrator,
  ImportSorter,
  parseImports,
} from "../mod.ts";

test("Node imports the ESM entry point and formats imports", () => {
  const { sourceFile, imports } = parseImports(
    'import b from "b";\nimport a from "a";\n',
  );
  const sorted = new ImportSorter(["sourceName"], []).sort(imports);
  assert.equal(
    new ImportIntegrator().integrate(sourceFile, sorted),
    'import a from "a";\nimport b from "b";\n',
  );
});

test("Node gets Deno-compatible defaults", () => {
  const config = new ConfigHandler();
  const { sourceFile, imports } = parseImports(
    'import {b, a} from "./b";\nimport "side";\n',
  );
  new ImportSorter(config.sortImports, config.sortImportElements).sort(imports);
  assert.equal(
    new ImportIntegrator(config.formatting).integrate(sourceFile, imports),
    'import { a, b } from "./b";\nimport "side";\n',
  );
});

test("Node loads a TOML config", () => {
  const dir = mkdtempSync(join(tmpdir(), "primp-toml-node-"));
  try {
    const path = join(dir, "primp.toml");
    writeFileSync(
      path,
      'sortImports = ["sourceName"]\n[formatting]\nquoteStyle = "single"\n',
    );
    const config = new ConfigHandler(path);
    assert.deepEqual(config.sortImports, ["sourceName"]);
    assert.equal(config.formatting.quoteStyle, "single");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Node can execute the CLI entry point", () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("../cli.ts", import.meta.url)),
    "--help",
  ], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: primp/);
  const version = spawnSync(process.execPath, [
    fileURLToPath(new URL("../cli.ts", import.meta.url)),
    "--version",
  ], { encoding: "utf8" });
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /^2\.0\.0\s*$/);
});

test("Node executes the transpiled CLI without TypeScript support", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  // Keep the output beside node_modules so its bare npm dependencies resolve.
  const dir = mkdtempSync(join(root, ".primp-js-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "package.json"), '{"type":"module"}');
    copyFileSync(join(root, "deno.json"), join(dir, "deno.json"));
    for (
      const name of [
        "cli.ts",
        "src/configuration.ts",
        "src/core.ts",
        "src/files.ts",
        "src/rules.ts",
      ]
    ) {
      const output = ts.transpileModule(
        readFileSync(join(root, name), "utf8"),
        {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            rewriteRelativeImportExtensions: true,
          },
          fileName: name,
        },
      );
      writeFileSync(join(dir, name.replace(/\.ts$/, ".js")), output.outputText);
    }
    const cli = join(dir, "cli.js");
    const help = spawnSync(process.execPath, [cli, "--help"], {
      encoding: "utf8",
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Usage: primp/);
    const version = spawnSync(process.execPath, [cli, "--version"], {
      encoding: "utf8",
    });
    assert.equal(version.status, 0, version.stderr);
    assert.match(version.stdout, /^2\.0\.0\s*$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
