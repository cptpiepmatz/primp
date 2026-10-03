import assert from "node:assert/strict";

import { parseCliArgs } from "@primp/primp/cli";

Deno.test("CLI args accept aliases, grouped switches and equals syntax", () => {
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
});

Deno.test("CLI args reject unknown options and missing arguments", () => {
  assert.throws(
    () => parseCliArgs(["--include-js", "src"]),
    /Unknown argument/,
  );
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
