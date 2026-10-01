<p align="center">
  <img width="250" alt="primp logo" src="./icon/primp.svg">
</p>
<h1 align="center">primp</h1>
<h3 align="center">pretty-ts-imports</h3>
<p align="center">
  <b>Sort your TS imports with rules of your own.</b>
</p>

<br>

<div align="center">

[![JSR (placeholder)](https://img.shields.io/badge/JSR-pending%20release-8683F2?style=for-the-badge)](https://jsr.io/@cptpiepmatz/pretty-ts-imports)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3%E2%80%936.x-3178C6?style=for-the-badge)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/github/license/cptpiepmatz/pretty-ts-imports?style=for-the-badge)](./LICENSE)
[![Test](https://img.shields.io/github/actions/workflow/status/cptpiepmatz/pretty-ts-imports/test.yml?label=Test&style=for-the-badge)](./.github/workflows/test.yml)

</div>

**primp** formats the leading block of TypeScript imports using the TypeScript
parser. It alphabetizes named specifiers by default; if you want more control,
you can sort imports and group them with configurable rules. The rest of the
file stays intact.

## Installation

Primp requires **Deno 2+** or **Node.js 22.18+** (for native TypeScript type
stripping). The package targets JSR as `@cptpiepmatz/pretty-ts-imports`. These
installation commands apply after its first release.

```sh
# Deno
deno add jsr:@cptpiepmatz/pretty-ts-imports

# Node.js, using JSR's npm compatibility bridge with npm
npx jsr add --npm @cptpiepmatz/pretty-ts-imports

# Install the CLI as a global command with Deno (also usable in Node projects)
deno install --global --allow-read --allow-write --allow-env --name primp jsr:@cptpiepmatz/pretty-ts-imports/cli
```

The parser supports TypeScript 5.3.3 through 6.x (verified against 5.3.3, 5.9.3,
and 6.0.3). The published package depends on TypeScript 6.x; npm can install it
alongside a project's TypeScript 5.x or 7.x. When running from source, a Deno
import map can instead select a compatible 5.x parser. TypeScript 7.x cannot
replace the parser dependency because its root export no longer provides the
APIs used here.

## Usage

Run primp on a file or directory. For example, to process `src` recursively:

```sh
# Deno
deno run --allow-read --allow-write --allow-env jsr:@cptpiepmatz/pretty-ts-imports/cli src -r

# After the global Deno CLI install above
primp src -r

# Node.js, after `npx jsr add --npm` in this project
node node_modules/@cptpiepmatz/pretty-ts-imports/cli.js src -r
```

The JSR package exports `/cli` for direct Deno execution and as a module for
Node. JSR's npm compatibility bridge transpiles `cli.ts` to `cli.js` in the
installed package, which Node can run directly. The generated npm-compatible
package has no `bin` metadata, so `npx @cptpiepmatz/pretty-ts-imports` and
global npm executable installs are not supported. The global `primp` command
installed with `deno install` runs under Deno and requires Deno installed.

### Arguments

Use flags to control how primp handles your files:

- `-r, --recursive` descend into subdirectories
- `-o, --output DIR` write to another directory instead of updating in place
- `-c, --config FILE` select a config file
- `-w, --watch` watch the selected files after the first pass
- `--help` show usage; `--version` show the package version

Directory searches include `.ts`, `.tsx`, `.mts`, and `.cts` files, but exclude
`.d.ts` and non-source files. Import blocks containing comments are left as-is
so comments cannot be detached from their imports; header comments before the
first import are preserved. The CLI also supports aliases, grouped short flags,
`--option=value`, and `--` for paths starting with a dash.

## Config

You can use a config to customize how primp handles imports. It looks for a
config in the input directory and its ancestors; use `-c` to select one
explicitly (especially if several configs are in the same directory).

Primp recognizes these extensions:

- `.json`, `.jsonc`, `.json5`
- `.yml`, `.yaml`
- `.toml`

And these file names: `primp`, `pretty-ts-imports`, and `prettytsimports`. With
`-c`, you can use any file name with a supported extension. JSONC allows
comments and trailing commas; TOML uses standard tables such as `[formatting]`.
See the [config examples](./examples/configs/) for all five formats, or the
commented [primp.json5](./examples/configs/primp.json5) and
[primp.yml](./examples/configs/primp.yml) for explanations.

Omitted fields use these defaults:

```json
{
  "sortImports": [],
  "sortImportElements": ["specifierName"],
  "separateBy": [],
  "formatting": {
    "indent": 2,
    "bracketIndent": 1,
    "maxColumns": 80,
    "quoteStyle": "double",
    "trailingComma": true,
    "breakFrom": false
  },
  "require": {}
}
```

By default, imports keep their order and existing blank lines; primp adds no
groups. Named specifiers use Deno-style ordering: imported name, then local
alias. To opt in to the old primp import order, grouping, and formatting:

```json
{
  "sortImports": [
    "!sideEffect",
    "sourceType",
    "!namespacePresence",
    "pathName",
    "sourceName"
  ],
  "sortImportElements": ["elementType", "basenameGroup", "elementName"],
  "separateBy": [
    "unequalSideEffectUse",
    "unequalPackageState",
    "unequalNamespaceUse"
  ],
  "formatting": {
    "bracketIndent": 0,
    "trailingComma": false,
    "breakFrom": true
  }
}
```

Sorting rules run left to right until the first nonzero comparison; prefix a
rule with `!` to reverse it. Import rules include `sideEffect`, `sourceType`,
`namespacePresence`, `defaultPresence`, `defaultType`, `sourceName`,
`pathDepth`, and `pathName`. Named-element rules include `elementType`,
`elementName`, `basenameGroup`, and `specifierName`. `separateBy` inserts a
blank line when any listed predicate is true. `bracketIndent` controls spaces
inside single-line named imports; `trailingComma` controls multiline named
imports; `breakFrom` opts into wrapping an overflowing `from` clause like the
old formatter. These options can differ from `deno fmt`, so configure both tools
if you use them on the same files.

For your own rules, default-export an ESM function and list its name in the
appropriate rule array. For example,
`"require": { "myRule": "./rules/my-rule.ts" }` resolves relative to the config
file. `.js` works in both runtimes; `.ts` works with Deno and Node 22.18+ if
Node can strip its types. Custom rules importing primp should use its JSR
package specifier (or the Node JSR bridge).

## Programmatic usage

Import the building blocks from the package root if you want to handle imports
in your own code:

```ts
import {
  ConfigHandler,
  ImportIntegrator,
  ImportSeparator,
  ImportSorter,
  parseImports,
} from "jsr:@cptpiepmatz/pretty-ts-imports";

const config = new ConfigHandler();
const { sourceFile, imports } = parseImports(
  'import b from "b";\nimport a from "a";\n',
);
const sorted = new ImportSorter(config.sortImports, config.sortImportElements)
  .sort(imports);
const grouped = new ImportSeparator(config.separateBy).insertSeparator(sorted);
console.log(
  new ImportIntegrator(config.formatting).integrate(sourceFile, grouped),
);
```

For API docs after publication, see
[JSR](https://jsr.io/@cptpiepmatz/pretty-ts-imports/doc); locally, run
`deno task docs` to generate documentation in `docs/`.

## Migrating from the npm package

The original `pretty-ts-imports` and `@cptpiepmatz/pretty-ts-imports` npm
packages used CommonJS bundles and `primp` / `pretty-ts-imports` executables.
Use the JSR package and its `/cli` entry point for scripts; programmatic imports
are now ESM named exports from the package root. `Import`, `ImportSorter`,
`ImportSeparator`, `ImportIntegrator`, `FileManager`, `ConfigHandler`,
comparator types, and `builtin` remain available; types use TypeScript
`import type`. `parseImports` is new. The old `OnDemandTranspiler` and CommonJS
custom-rule loader are gone: convert custom rules to ESM default exports. `-t` /
`--tsconfig` have been removed; drop those flags from scripts. The first
`FileManager` constructor argument (the tsconfig path) has also been removed:
use `new FileManager(filePaths)`. Syntactic parsing no longer reads a tsconfig.
`getFiles` filters non-TypeScript files, and `--watch` watches selected files.
Node versions below 22.18 are unsupported. To restore the old ordering and
formatting, use the config above.

## Development

Run `deno task test`, `deno task check`, `deno task lint`, and `deno task fmt`.
For a local Node smoke test, run `deno install` then `deno task test:node`
(Node.js 22.18+). Deno installs the npm dependencies from `deno.json` into
`node_modules` for this test.

After reviewing the package and confirming JSR ownership, publish with
`deno publish --dry-run` followed by `deno publish`.

Before retiring npm, publish a manual final npm notice release with a migration
pointer (or update the old README), then deprecate both npm names using
`npm deprecate <package>@<version-range> "Moved to JSR: https://jsr.io/@cptpiepmatz/pretty-ts-imports"`.
Confirm ownership, namespace, and published version first; this repository does
not publish or deprecate the npm packages automatically.
