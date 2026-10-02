# Modernization plan

| Area                   | 2022 behavior to keep                                                       | Replacement / removal                                                                                                                              | Compatibility risk                                                     |
| ---------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Package / modules      | Library exports, `primp` CLI                                                | JSR ESM entry points; remove bundled UMD/CommonJS artifacts                                                                                        | Imports must use JSR or the new ESM entry point                        |
| Core                   | TypeScript AST import extraction, configurable sorting, grouping, rendering | Small pure TypeScript modules using the TypeScript parser                                                                                          | Modern import attributes and inline `type` specifiers must not be lost |
| Configuration          | Upward discovery, defaults, inverted rules, custom comparators              | TypeScript config modules with default exports, optional `defineConfig`, and direct custom functions                                               | Configs and custom rules must run on a TS-aware runtime                |
| Runtime / filesystem   | CLI file traversal, output, watch, newline retention                        | Isolated `node:` filesystem adapter supported by Deno and Node; pure string transformation in core                                                 | Directory output paths and Windows separators                          |
| Testing                | Old Jasmine behavior and fixtures                                           | Focused `deno test` behavioral and filesystem tests; Node smoke test                                                                               | No more Jasmine globals                                                |
| Tooling / dependencies | TypeScript parser, yargs                                                    | Keep parser and CLI argument handling; Deno fmt/lint/check/test/task replace browserify, terser, ts-node, nyc, jasmine, typedoc and config parsers | JSR and Node must resolve npm dependencies                             |
| Publishing             | npm package names and executable aliases                                    | JSR metadata and documented manual npm deprecation/migration                                                                                       | Do not deprecate or publish automatically                              |
| Documentation          | CLI flags, formats, programmable comparator API                             | ESM examples, supported runtimes, migration notes                                                                                                  | Legacy API shape changes documented in README                          |

Node 22.18+ and Deno 2+ are the supported runtime targets. TypeScript remains
necessary for parsing. The core does not depend on filesystem or runtime
globals. Existing npm publishing is deliberately a manual follow-up. Defaults
retain the old import declaration sorting and grouping while formatting and
sorting named specifiers so that `deno fmt` does not rewrite the result. The old
named-specifier grouping and non-Deno formatting remain configurable.
