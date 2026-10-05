import { main } from "@primp/primp/cli";
import { expect } from "@std/expect";
import { join } from "@std/path";

Deno.test("--check reports only unformatted files without writing", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "primp-check-" });
  const log = console.log;
  const reported: string[] = [];
  try {
    const config = join(dir, "primp.config.ts");
    Deno.writeTextFileSync(config, "export default {};");
    const dirty = join(dir, "dirty.ts");
    const clean = join(dir, "clean.ts");
    const original = 'import z from "z";\r\nimport a from "a";\r\n';
    Deno.writeTextFileSync(dirty, original);
    Deno.writeTextFileSync(
      clean,
      'import a from "a";\r\nimport z from "z";\r\n',
    );
    console.log = (message: string) => reported.push(message);
    expect(await main(["--check", "--config", config, dir])).toBe(true);
    expect(reported).toEqual([dirty]);
    expect(Deno.readTextFileSync(dirty)).toBe(original);
    expect(await main(["--config", config, dirty])).toBe(false);
    reported.length = 0;
    expect(await main(["--check", "--config", config, dir])).toBe(false);
    expect(reported).toEqual([]);
  } finally {
    console.log = log;
    Deno.removeSync(dir, { recursive: true });
  }
});

Deno.test("--check uses exit status 1 for unformatted files", async () => {
  const dir = Deno.makeTempDirSync({ prefix: "primp-check-exit-" });
  try {
    const file = join(dir, "input.ts");
    const original = 'import z from "z";\nimport a from "a";\n';
    Deno.writeTextFileSync(file, original);
    const cli = new URL("../../packages/primp/cli.ts", import.meta.url);
    const run = async () => {
      const command = new Deno.Command(Deno.execPath(), {
        args: ["run", "--allow-read", "--allow-env", cli.href, "--check", file],
      });
      return await command.output();
    };
    const dirty = await run();
    expect(dirty.code).toBe(1);
    expect(new TextDecoder().decode(dirty.stdout).trim()).toBe(file);
    expect(Deno.readTextFileSync(file)).toBe(original);
    Deno.writeTextFileSync(file, 'import a from "a";\nimport z from "z";\n');
    const clean = await run();
    expect(clean.code).toBe(0);
    expect(new TextDecoder().decode(clean.stdout)).toBe("");
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
});
