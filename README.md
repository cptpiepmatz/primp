<p align="center">
  <img width="250" alt="primp logo" src="./icon/primp.svg">
</p>
<h1 align="center">primp</h1>
<h3 align="center">TypeScript and Vue import formatter</h3>
<p align="center">
  <b>Sort your TS imports with rules of your own.</b>
</p>

<br>

<div align="center">

[![JSR (placeholder)](https://img.shields.io/badge/JSR-pending%20release-8683F2?style=for-the-badge)](https://jsr.io/@primp/primp)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3%E2%80%936.x-3178C6?style=for-the-badge)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/github/license/cptpiepmatz/primp?style=for-the-badge)](./LICENSE)
[![Test](https://img.shields.io/github/actions/workflow/status/cptpiepmatz/primp/test.yml?label=Test&style=for-the-badge)](./.github/workflows/test.yml)

</div>

**primp** formats the leading block of TypeScript imports using the TypeScript
parser. By default, it sorts and groups import declarations as in the original
primp, while formatting named specifiers compatibly with `deno fmt`. The rules
are configurable. The rest of the file stays intact.

## Installation

Primp requires **Deno 2+** or **Node.js 22.18+** (for native TypeScript type
stripping). The core package targets JSR as `@primp/primp`. These installation
commands apply after its first release.

```sh
# Deno
deno add jsr:@primp/primp

# Node.js, using JSR's npm compatibility bridge with npm
npx jsr add --npm @primp/primp

# Install the CLI as a global command with Deno (also usable in Node projects)
deno install --global --allow-read --allow-write --allow-env --name primp jsr:@primp/primp/cli
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
deno run --allow-read --allow-write --allow-env jsr:@primp/primp/cli src -r

# After the global Deno CLI install above
primp src -r

# Node.js, after `npx jsr add --npm` in this project
node node_modules/@primp/primp/cli.js src -r
```

You can also pass several files or directories in one invocation, including
paths expanded by a shell or another tool (for example,
`primp src/*.ts tests/*.ts`). Primp discovers one config from the current
working directory for all inputs, unless `--config` is provided. With
`--output`, results from multiple folders retain their relative directory
structure.

The JSR package exports `/cli` for direct Deno execution and as a module for
Node. JSR's npm compatibility bridge transpiles `cli.ts` to `cli.js` in the
installed package, which Node can run directly. The generated npm-compatible
package has no `bin` metadata, so `npx @primp/primp` and global npm executable
installs are not supported. The global `primp` command installed with
`deno install` runs under Deno and requires Deno installed.

### Arguments

Use flags to control how primp handles your files:

- `-r, --recursive` descend into subdirectories
- `-o, --output DIR` write to another directory instead of updating in place
- `-c, --config FILE` select a config file
- `-w, --watch` watch the selected files after the first pass
- `--help` show usage; `--version` show the package version

Directory searches include `.ts`, `.tsx`, `.mts`, and `.cts` files by default,
but exclude `.d.ts` and non-source files. Register `jsExtractor` to also process
`.js`, `.jsx`, `.mjs`, and `.cjs` files. Other registered extractors, such as
the Vue adapter, participate in directory scans too. Explicit paths to files
without a matching extractor are skipped. Import blocks containing comments are
left as-is so comments cannot be detached from their imports; header comments
before the first import are preserved. The CLI also supports aliases, grouped
short flags, `--option=value`, and `--` for paths starting with a dash.

## Config

Create a `primp.config.ts` with a default-exported object. Primp searches the
current working directory and its ancestors for `primp.config.ts`,
`pretty-ts-imports.config.ts`, or `prettytsimports.config.ts` (in that order).
Use `-c` to select any `.ts` config file explicitly. The runtime must be able to
import TypeScript modules (Deno 2+ or Node 22.18+). The optional `defineConfig`
helper provides type checking and editor completion:

```ts
import { defineConfig } from "jsr:@primp/primp";
import { sourceName } from "jsr:@primp/primp/rules/imports";

export default defineConfig({
  sortImports: [sourceName],
  formatting: { quoteStyle: "single" },
});
```

Plain `export default { ... }` works too. See the
[full example](./examples/configs/primp.config.ts).

Built-ins are split across `/rules/imports`, `/rules/elements`, and
`/rules/separators`. Each category exports its rules individually and as a group
(`compareImports`, `compareImportElements`, or `separateBy`). For example, you
can write `const { sideEffect, sourceName } = compareImports` if you prefer
destructuring. The package root exports `defineConfig`, `inverse`, and the
sorting and formatting APIs. In a Node project installed through the JSR npm
bridge, use `"@primp/primp/rules/imports"` (and the corresponding other
subpaths). In this repository, the Deno workspace resolves `@primp/*` imports to
local packages, including in `examples/`. Omitted fields use these defaults:

```ts
import { inverse, tsExtractor } from "jsr:@primp/primp";
import { specifierName } from "jsr:@primp/primp/rules/elements";
import {
  directoryName,
  namespaceImport,
  packageFirst,
  sideEffect,
  sourceName,
} from "jsr:@primp/primp/rules/imports";
import * as separators from "jsr:@primp/primp/rules/separators";

export default {
  extractors: [tsExtractor],
  sortImports: [
    inverse(sideEffect),
    packageFirst,
    inverse(namespaceImport),
    directoryName,
    sourceName,
  ],
  sortImportElements: [specifierName],
  separateBy: [
    separators.sideEffect,
    separators.packageSource,
    separators.namespace,
  ],
  formatting: {
    indent: 2,
    bracketIndent: 1,
    maxColumns: 80,
    quoteStyle: "double",
    trailingComma: true,
    breakFrom: false,
  },
};
```

By default, primp sorts and groups import declarations as in the old version.
`deno fmt` preserves that order and those blank lines. Named specifiers use
Deno-style ordering (imported name, then local alias), with Deno-compatible
spacing and multiline commas. To opt in to the old named-specifier grouping and
formatting:

```ts
import { defineConfig } from "jsr:@primp/primp";
import {
  elementName,
  lowercaseFirst,
  nameSuffix,
} from "jsr:@primp/primp/rules/elements";

export default defineConfig({
  sortImportElements: [
    lowercaseFirst,
    nameSuffix,
    elementName,
  ],
  formatting: {
    bracketIndent: 0,
    trailingComma: false,
    breakFrom: true,
  },
});
```

Sorting rules run left to right until the first nonzero comparison. Wrap any
comparator with `inverse(rule)` to reverse it, including custom comparators and
named-element rules. Import comparators include `sideEffect`, `packageFirst`,
`namespaceImport`, `defaultImport`, `uppercaseDefault`, `sourceName`,
`pathDepth`, `directoryName`, `typeOnly`, and `nodePrefix` (`node:` imports
first). Named-element rules include `lowercaseFirst`, `elementName`,
`nameSuffix`, and `specifierName`. The `separateBy` option inserts a blank line
when any listed predicate is true; `separators.nodePrefix` separates `node:`
imports from other imports. To opt in while retaining the other default rules,
configure:

```ts
import { defineConfig, inverse } from "jsr:@primp/primp";
import {
  directoryName,
  namespaceImport,
  nodePrefix,
  packageFirst,
  sideEffect,
  sourceName,
} from "jsr:@primp/primp/rules/imports";
import * as separators from "jsr:@primp/primp/rules/separators";

export default defineConfig({
  sortImports: [
    nodePrefix,
    inverse(sideEffect),
    packageFirst,
    inverse(namespaceImport),
    directoryName,
    sourceName,
  ],
  separateBy: [
    separators.nodePrefix,
    separators.sideEffect,
    separators.packageSource,
    separators.namespace,
  ],
});
```

`bracketIndent` controls spaces inside single-line named imports;
`trailingComma` controls multiline named imports; `breakFrom` opts into wrapping
an overflowing `from` clause like the old formatter. These options can differ
from `deno fmt`, so configure both tools if you use them on the same files.

Custom functions can be written inline or imported relative to the config file
and placed directly in the appropriate array:

```ts
import { defineConfig, inverse } from "jsr:@primp/primp";
import { sourceName } from "jsr:@primp/primp/rules/imports";
import myRule from "./rules/my-rule.ts";

export default defineConfig({
  sortImports: [inverse(myRule), sourceName],
});
```

Custom rules importing primp should use its JSR package specifier (or the Node
JSR bridge). An empty rule array disables that sorting or grouping stage.

## JavaScript files

To format JavaScript files, add the optional built-in extractor to your config:

```ts
import { defineConfig, jsExtractor } from "jsr:@primp/primp";

export default defineConfig({ extractors: [jsExtractor] });
```

## Vue single-file components

Vue support is an additional package: install it only when you format Vue
components. `@primp/primp` does not depend on Vue or its compiler.

```sh
deno add jsr:@primp/vue
# Or for Node.js through JSR's npm bridge:
npx jsr add --npm @primp/vue
```

```ts
import { formatImports } from "jsr:@primp/primp";
import { vueExtractor } from "jsr:@primp/vue";

const formatted = formatImports(
  `
<script setup lang="ts">
import z from "z";
import a from "a";
</script>
`,
  { extractors: [vueExtractor] },
  "component.vue",
);
```

`@primp/vue` only extracts script slices; `@primp/primp` sorts and formats their
imports and reinserts them into the original component. Each extractor declares
its own `extensions` matcher (an extension string, filename regex, or filename
predicate) and an `extract(source, filename)` function. The first matching
extractor in the config list is used. The same `extractors` config can be used
in `primp.config.ts` so the CLI discovers `.vue` files in directories. See the
[Vue config example](./examples/vue/primp.config.ts). The built-in `tsExtractor`
handles TypeScript as a single whole-file slice; `jsExtractor` does the same for
JavaScript when configured. Custom extractors are checked before the built-in
TypeScript extractor, so they can override it for matching files. Templates,
styles, and other parts of the SFC remain intact. External scripts and
unsupported script languages are skipped.

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
} from "jsr:@primp/primp";

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

For API docs after publication, see [JSR](https://jsr.io/@primp/primp/doc);
locally, run `deno task docs` to generate documentation for each entry point:
[main package](docs/index.html), [Vue](docs/vue/index.html), and the built-in
rules ([imports](docs/imports/index.html), [elements](docs/elements/index.html),
[separators](docs/separators/index.html)).

## Migrating from the npm package

The original `pretty-ts-imports` and `@cptpiepmatz/pretty-ts-imports` npm
packages used CommonJS bundles and `primp` / `pretty-ts-imports` executables.
Use the JSR package and its `/cli` entry point for scripts; programmatic imports
are now ESM named exports from the package root. `Import`, `ImportSorter`,
`ImportSeparator`, `ImportIntegrator`, `FileManager`, `ConfigHandler`,
comparator types remain available from the package root; built-in functions are
available from the three `/rules/*` category entry points. Types use TypeScript
`import type`. `parseImports` is new. The old `OnDemandTranspiler` and CommonJS
custom-rule loader are gone: convert custom rules to ESM default exports. `-t` /
`--tsconfig` have been removed; drop those flags from scripts. The first
`FileManager` constructor argument (the tsconfig path) has also been removed:
use `new FileManager(filePaths)`. Syntactic parsing no longer reads a tsconfig.
`getFiles` filters non-TypeScript files, and `--watch` watches selected files.
Node versions below 22.18 are unsupported. To restore the old ordering and
formatting, use the config above.

Existing JSON, JSONC, JSON5, YAML, and TOML configs must be converted to a
default-exported `.config.ts` object. Import custom functions instead of using
`require`; replace rule names in the arrays with function references from the
built-in exports or your imports. Replace `"!ruleName"` with `inverse(rule)`.

## Development

The Deno workspace contains `packages/primp` and `packages/vue`; its root config
resolves local `@primp/*` imports in examples and tests. Run `deno task test`,
`deno task check`, `deno task lint`, and `deno task fmt`. For a local Node smoke
test, run `deno install` then `deno task test:node` (Node.js 22.18+). Deno
installs the npm dependencies from `deno.json` into `node_modules` for this
test.

After reviewing both packages and confirming JSR ownership, publish with
`deno publish --dry-run` followed by `deno publish` from the workspace root.

Before retiring npm, publish a manual final npm notice release with a migration
pointer (or update the old README), then deprecate both npm names using
`npm deprecate <package>@<version-range> "Moved to JSR: https://jsr.io/@primp/primp"`.
Confirm ownership, namespace, and published version first; this repository does
not publish or deprecate the npm packages automatically.
