<p align="center">
  <img width="250" alt="primp logo" src="https://raw.githubusercontent.com/cptpiepmatz/primp/a2a2b6051eb08e47b23f6ba32ebd01288a135394/icon/primp.svg">
</p>
<h1 align="center">primp</h1>
<p align="center">
  <b>Sort your TypeScript imports with rules of your own.</b>
</p>

<br>

<div align="center">

[![JSR](https://img.shields.io/badge/JSR-pending%20release-8683F2?style=for-the-badge)](https://jsr.io/@primp/primp)
[![Deno](https://img.shields.io/badge/Deno-2+-000000?style=for-the-badge&logo=deno)](https://deno.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22.18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/github/license/cptpiepmatz/primp?style=for-the-badge)](./LICENSE)
[![Test](https://img.shields.io/github/actions/workflow/status/cptpiepmatz/primp/test.yml?label=Test&style=for-the-badge)](./.github/workflows/test.yml)

</div>

## About

**primp** is an import formatter for TypeScript, with optional JavaScript and
Vue support. It parses imports using the TypeScript parser, sorts them with a
chain of rules, and groups them with blank lines. You can use the defaults or
define exactly how your imports should look.

The formatter works on the leading import block and leaves the rest of your code
intact. Use it from the command line or as a library in your own tooling.

## Features

- **Your own import order:** Combine built-in comparators, reverse them, or
  write custom functions in a TypeScript config.
- **Separate sorting and grouping:** Decide both where imports belong and where
  blank lines go.
- **Consistent formatting:** Sort named specifiers and configure quotes,
  indentation, and line wrapping. Defaults work with `deno fmt`.
- **Modern syntax:** Preserve type-only imports, inline `type` specifiers, and
  import attributes.
- **CLI workflow:** Process several paths, recurse through directories, watch
  files, or check formatting in CI.
- **Extensible file support:** Register extractors for JavaScript, Vue SFCs, or
  your own source format.

## Packages

| Package                                        | What it provides                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| [**@primp/primp**](./packages/primp/README.md) | Import formatter, CLI, configuration, and built-in rules.                   |
| [**@primp/vue**](./packages/vue/README.md)     | An extractor for imports inside Vue `<script>` and `<script setup>` blocks. |

The core package does not depend on Vue. Add the adapter when you need to format
single-file components.

## Installation

Primp supports **Deno 2+** and **Node.js 22.18+**. Packages target
[JSR](https://jsr.io/@primp); the commands below apply after the first release.

```sh
# Deno
deno add jsr:@primp/primp

# Node.js, through JSR's npm compatibility bridge
npx jsr add --npm @primp/primp
```

To make `primp` available as a global command, install the CLI with Deno:

```sh
deno install --global --allow-read --allow-write --allow-env --name primp jsr:@primp/primp/cli
```

## Usage

```sh
# Format a directory recursively
primp src -r

# Format several files or directories
primp src tests index.ts -r

# Check formatting without writing files
primp src -r --check
```

You can also run the CLI directly:

```sh
# Deno
deno run --allow-read --allow-write --allow-env jsr:@primp/primp/cli src -r

# Node.js, after installing the package through JSR
node node_modules/@primp/primp/cli.js src -r
```

Create a `primp.config.ts` to customize the rules:

```ts
import { defineConfig } from "jsr:@primp/primp";
import { sourceName } from "jsr:@primp/primp/rules/imports";

export default defineConfig({
  sortImports: [sourceName],
  formatting: { quoteStyle: "single" },
});
```

For library use, pass source text to `formatImports`:

```ts
import { formatImports } from "jsr:@primp/primp";

const formatted = formatImports('import { b, a } from "pkg";\n');
// import { a, b } from "pkg";
```

In Node projects, use `"@primp/primp"` and its corresponding subpaths instead of
`"jsr:@primp/primp"`. See the [core package guide](./packages/primp/README.md)
for CLI flags, configuration, and migration from `pretty-ts-imports`, or the
[Vue guide](./packages/vue/README.md) to add SFC support.

## Examples

- [Configuration](./examples/configs/primp.config.ts): Built-in rules, a custom
  comparator, and the original formatting style.
- [Custom comparators](./examples/compare_functions/): Rules for import
  declarations.
- [Vue configuration](./examples/vue/primp.config.ts): Register the Vue adapter.

The workspace resolves `@primp/*` imports in these examples to the local
packages. After publication, API documentation is available on JSR for
[@primp/primp](https://jsr.io/@primp/primp/doc) and
[@primp/vue](https://jsr.io/@primp/vue/doc).

## Contributing

Issues and pull requests are welcome. The repository is a Deno workspace with
the core formatter in `packages/primp`, the Vue adapter in `packages/vue`, and
shared tests in `tests`.

Use the local CLI while developing:

```sh
deno task cli src -r
```

## Testing

With Deno 2+ and Node.js 22.18+ installed, run:

```sh
deno install
deno task check
deno task lint
deno task test
```

`deno task test` runs both the Deno suite and Node smoke tests. You can run them
separately with `deno task test:deno` and `deno task test:node`. Use
`deno task fmt` to format the workspace and its imports, and `deno fmt --check`
to check source formatting.

To inspect the API locally, run `deno doc packages/primp/mod.ts` or
`deno doc packages/vue/mod.ts`. To validate both packages for publication, run
`deno publish --dry-run` from the workspace root.

## License

**primp** is released under the [MIT License](./LICENSE).
