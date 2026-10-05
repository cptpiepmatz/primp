import { expect } from "@std/expect";

import { parseCliArgs } from "@primp/primp/cli";

Deno.test("CLI args accept aliases, grouped switches and equals syntax", () => {
  expect(
    parseCliArgs([
      "-rw",
      "--output=out",
      "--config",
      "primp.config.ts",
      "src",
    ]),
  ).toEqual({
    inputs: ["src"],
    recursive: true,
    watch: true,
    output: "out",
    config: "primp.config.ts",
  });
  expect(parseCliArgs(["--", "-file.ts"])?.inputs).toEqual(["-file.ts"]);
  expect(parseCliArgs(["a.ts", "b.ts"])?.inputs).toEqual([
    "a.ts",
    "b.ts",
  ]);
});

Deno.test("CLI args reject unknown options and missing arguments", () => {
  expect(() => parseCliArgs(["--include-js", "src"]))
    .toThrow(/Unknown argument/);
  expect(() => parseCliArgs(["--no-include-js", "src"]))
    .toThrow(/Unknown argument/);
  expect(() => parseCliArgs(["--nonsense", "src"]))
    .toThrow(/Unknown argument/);
  expect(() => parseCliArgs(["-t", "tsconfig.json", "src"]))
    .toThrow(/Unknown argument/);
  expect(() => parseCliArgs(["--tsconfig=tsconfig.json", "src"]))
    .toThrow(/Unknown argument/);
  expect(() => parseCliArgs(["src", "--output"]))
    .toThrow(
      /requires an argument|Not enough arguments|Missing required argument/,
    );
  expect(() => parseCliArgs([])).toThrow(/at least one/);
});
