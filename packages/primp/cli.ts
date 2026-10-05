/**
 * Run the import formatter from the command line.
 *
 * The exported helpers can be called without executing the command-line entry
 * point. Run this module directly to process files with `primp` options.
 *
 * @module
 */

import { realpathSync, watch } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import yargs from "yargs";

import metadata from "./deno.json" with { type: "json" };
import { ConfigHandler } from "./src/configuration.ts";
import { FileManager } from "./src/files.ts";
import { matchesExtractor } from "./src/extractors.ts";
import { formatImports } from "./src/format.ts";

/** Parsed command-line options for the JSR `/cli` entry point. */
export interface CliOptions {
  /** Source files or directories. */
  inputs: string[];

  /** Descend into subdirectories for directory inputs. */
  recursive: boolean;

  /** Write files beneath this directory instead of updating them in place. */
  output?: string;

  /** Explicit primp config; otherwise discovered from the working directory. */
  config?: string;

  /** Watch selected source files for changes after the first pass. */
  watch: boolean;

  /** Report files needing formatting without writing them. */
  check: boolean;
}

/**
 * Parse command-line arguments into CLI options.
 *
 * Use yargs without reading process globals or exiting the caller. Help or
 * version flags print their output and return `undefined`; invalid options or
 * no input paths throw an error.
 *
 * @param args Command-line arguments, excluding the executable name.
 * @returns Parsed options, or `undefined` for help or version requests.
 */
export function parseCliArgs(args: string[]): CliOptions | undefined {
  const argv = yargs(args)
    .parserConfiguration({ "boolean-negation": false })
    .scriptName("primp")
    .usage("Usage: primp [options] <file|directory> [file|directory ...]")
    .option("recursive", {
      alias: "r",
      type: "boolean",
      default: false,
      describe: "Traverse directories",
    })
    .option("output", {
      alias: "o",
      type: "string",
      describe: "Write into DIR",
    })
    .option("config", {
      alias: "c",
      type: "string",
      describe: "Configuration file",
    })
    .option("watch", {
      alias: "w",
      type: "boolean",
      default: false,
      describe: "Watch files",
    })
    .option("check", {
      type: "boolean",
      default: false,
      describe: "Check formatting without writing files",
    })
    .requiresArg(["output", "config"])
    .help("help")
    .alias("help", "h")
    .version(metadata.version)
    .strictOptions()
    .exitProcess(false)
    .fail((message: string, error: Error | undefined) => {
      throw error ?? new Error(message);
    })
    .parseSync();
  if (argv.help || argv.version) return undefined;
  if (argv._.length === 0) {
    throw new Error("Expected at least one file or directory");
  }
  if (argv.check && (argv.watch || argv.output !== undefined)) {
    throw new Error("--check conflicts with --watch and --output");
  }
  return {
    inputs: argv._.map(String),
    recursive: argv.recursive,
    output: argv.output,
    config: argv.config,
    watch: argv.watch,
    check: argv.check,
  };
}

function commonDirectory(paths: string[]): string {
  let base = dirname(paths[0]);
  for (const path of paths.slice(1)) {
    const directory = dirname(path);
    while (true) {
      const remainder = relative(base, directory);
      if (
        remainder !== ".." && !remainder.startsWith(`..${sep}`) &&
        !isAbsolute(remainder)
      ) break;
      const parent = dirname(base);
      if (parent === base) {
        throw new Error("Output paths must be on the same drive");
      }
      base = parent;
    }
  }
  return base;
}

/**
 * Process files using the discovered or explicitly provided config.
 *
 * Sort, optionally group, and format each file once, then watch the selected
 * files if requested. In check mode, report files needing formatting and
 * return whether any differ. Errors propagate to the caller; only invoking
 * this module directly sets a process exit code.
 *
 * @param args Command-line arguments, excluding the executable name.
 */
export async function main(args: string[]): Promise<boolean> {
  const options = parseCliArgs(args);
  if (!options) return false;
  const { inputs, output } = options;
  const configPath = options.config ?? ConfigHandler.findConfig(".");
  const config = await ConfigHandler.load(configPath);
  const selected = new Set<string>();
  const directories = inputs.map((input) => {
    const files = FileManager.getFiles(
      input,
      options.recursive,
      (filename) =>
        config.extractors.some((extractor) =>
          matchesExtractor(extractor, filename)
        ),
    );
    for (const path of Array.isArray(files) ? files : [files]) {
      selected.add(resolve(path));
    }
    return Array.isArray(files);
  });
  const paths = [...selected];
  const outputBase = output === undefined || selected.size === 0
    ? undefined
    : inputs.length === 1 && directories[0]
    ? resolve(inputs[0])
    : commonDirectory(paths);
  const manager = new FileManager(paths);
  let changed = false;
  const processFile = (path: string): void => {
    manager.reloadFromDisk(path);
    const source = manager.imports.get(resolve(path))!.sourceFile.text;
    const content = formatImports(source, config, path);
    if (options.check) {
      if (manager.hasChanges(path, content)) {
        console.log(path);
        changed = true;
      }
      return;
    }
    const target = output !== undefined && outputBase !== undefined
      ? join(output, relative(outputBase, resolve(path)))
      : undefined;
    manager.write(path, content, target);
  };
  for (const path of paths) processFile(path);
  if (options.watch) {
    for (const path of paths) {
      watch(path, () => {
        try {
          processFile(path);
        } catch (error) {
          console.error(error);
        }
      });
    }
  }
  return changed;
}

// Importing the CLI does not execute it.
const invoked = typeof Deno !== "undefined"
  ? import.meta.main
  : process.argv[1] !== undefined &&
    import.meta.url ===
      pathToFileURL(realpathSync(resolve(process.argv[1]))).href;
if (invoked) {
  main(typeof Deno !== "undefined" ? Deno.args : process.argv.slice(2)).then(
    (changed) => {
      if (changed) {
        if (typeof Deno !== "undefined") Deno.exitCode = 1;
        else process.exitCode = 1;
      }
    },
    (error: unknown) => {
      console.error(error);
      if (typeof Deno !== "undefined") Deno.exitCode = 1;
      else process.exitCode = 1;
    },
  );
}
