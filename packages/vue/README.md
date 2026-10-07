<p align="center">
  <img width="250" alt="primp logo" src="https://raw.githubusercontent.com/cptpiepmatz/primp/a2a2b6051eb08e47b23f6ba32ebd01288a135394/icon/primp.svg">
</p>

# @primp/vue

**Format imports inside Vue single-file components with primp.**

<br>

[![JSR](https://img.shields.io/badge/JSR-pending%20release-8683F2?style=for-the-badge)](https://jsr.io/@primp/vue)
[![Vue](https://img.shields.io/badge/Vue-3.5+-4FC08D?style=for-the-badge&logo=vue.js)](https://vuejs.org/)
[![License](https://img.shields.io/github/license/cptpiepmatz/primp?style=for-the-badge)](https://github.com/cptpiepmatz/primp/blob/main/LICENSE)

## About

**@primp/vue** adds Vue single-file component support to
[@primp/primp](../primp/README.md). It uses Vue's `@vue/compiler-sfc` parser to
extract script blocks, then lets primp sort and format their imports using the
same rules as ordinary TypeScript files.

The adapter is a separate package, so projects that only format TypeScript do
not need the Vue compiler.

## Features

- **Both script blocks:** Handle `<script>` and `<script setup>` independently.
- **JavaScript and TypeScript:** Support scripts without a `lang` attribute and
  scripts with `lang="js"`, `"jsx"`, `"ts"`, or `"tsx"`.
- **Preserve the component:** Templates, styles, custom blocks, and code outside
  the leading imports remain intact.
- **Shared configuration:** Use the same sorting, grouping, and formatting rules
  as the core package, from the CLI or a library call.

## Installation

Requires **Deno 2+** or **Node.js 22.18+**. Both packages target JSR; these
commands apply after the first release.

```sh
# Deno
deno add jsr:@primp/primp jsr:@primp/vue

# Node.js, through JSR's npm compatibility bridge
npx jsr add --npm @primp/primp @primp/vue
```

In Node projects, use `@primp/primp` and `@primp/vue` in imports instead of the
`jsr:` specifiers below.

## Usage

### Command line

Register the adapter in your project's `primp.config.ts`:

```ts
import { defineConfig, tsExtractor } from "jsr:@primp/primp";
import { vueExtractor } from "jsr:@primp/vue";

export default defineConfig({
  extractors: [tsExtractor, vueExtractor],
});
```

Run the core CLI to format both TypeScript files and Vue components:

```sh
deno run --allow-read --allow-write --allow-env jsr:@primp/primp/cli src -r

# Or, after installing the global primp command
primp src -r

# Check formatting in CI
primp src -r --check
```

For Node.js after the JSR npm-bridge installation:

```sh
node node_modules/@primp/primp/cli.js src -r
```

Providing an extractor list replaces the core default. Keep `tsExtractor` to
include ordinary TypeScript files, add `jsExtractor` for standalone JavaScript,
or use only `[vueExtractor]` to process Vue components. Scripts inside Vue
components do not require `jsExtractor`.

See the [core CLI guide](../primp/README.md#command-line) for installation,
flags, and config discovery, or the
[Vue config example](../../examples/vue/primp.config.ts).

### Library

Pass the adapter and a `.vue` filename to `formatImports`:

```ts
import { formatImports } from "jsr:@primp/primp";
import { vueExtractor } from "jsr:@primp/vue";

const source = `<script setup lang="ts">
import { ref, computed } from "vue";

const count = ref(0);
const doubled = computed(() => count.value * 2);
</script>

<template>
  <p>{{ doubled }}</p>
</template>
`;

const formatted = formatImports(
  source,
  { extractors: [vueExtractor] },
  "Counter.vue",
);
// The import becomes: import { computed, ref } from "vue";
```

The filename selects the extractor; without it, `formatImports` defaults to a
TypeScript filename. Add any core config options alongside `extractors` to
customize the output.

## API

The package exports two building blocks:

| Export                                 | Purpose                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `vueExtractor`                         | An `Extractor` matching `.vue` files, ready for `Config.extractors`.                              |
| `extractVueScripts(source, filename?)` | Return script slices with `start`, `end`, and `content`; the default filename is `component.vue`. |

`extractVueScripts` only extracts source; it does not sort or format imports.
For example, use it to inspect the script sections yourself:

```ts
import { extractVueScripts } from "jsr:@primp/vue";

const scripts = extractVueScripts(
  '<script setup lang="ts">import a from "a";</script>',
  "Example.vue",
);
```

External `<script src="...">` blocks and unsupported script languages are
skipped. If Vue's parser reports errors, the extractor returns no slices and
primp leaves the component unchanged. Inside each supported script, the core
formatter's leading-import and comment-preservation behavior applies.

After publication, see the [API documentation](https://jsr.io/@primp/vue/doc).
Locally, run `deno doc packages/vue/mod.ts` from the repository root.

## Testing

The adapter is tested in the shared workspace suite. From the repository root:

```sh
deno install
deno task check
deno task test
```

See the [repository guide](../../README.md#testing) for the remaining
development commands.

## License

**@primp/vue** is released under the [MIT License](../../LICENSE).
