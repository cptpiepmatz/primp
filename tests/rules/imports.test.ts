import assert from "node:assert/strict";

import {
  ConfigHandler,
  defaultConfig,
  ImportIntegrator,
  ImportSeparator,
  ImportSorter,
  inverse,
  parseImports,
} from "@primp/primp";
import type { Import } from "@primp/primp";
import * as compareImports from "@primp/primp/rules/imports";
import * as separateBy from "@primp/primp/rules/separators";

import { expectImportOrder, expectReordered, ts } from "./mod.ts";

Deno.test("defaultPresence puts imports with default bindings first", () => {
  const input = ts`
    import {stuff} from "things";
    import {a, b, c} from "alpha";
    import d, {e, f} from "beta";
    import random from "weird";
  `;
  const expected = ts`
    import d, {e, f} from "beta";
    import random from "weird";
    import {stuff} from "things";
    import {a, b, c} from "alpha";
  `;
  expectImportOrder(input, expected, compareImports.defaultPresence);
});

Deno.test("defaultType orders uppercase defaults before lowercase defaults", () => {
  const input = ts`
    import {gamma} from "Gamma";
    import alpha from "Alpha";
    import Beta from "Beta";
    import Delta from "Delta";
    import epsilon from "Epsilon";
  `;
  const expected = ts`
    import {gamma} from "Gamma";
    import Beta from "Beta";
    import Delta from "Delta";
    import alpha from "Alpha";
    import epsilon from "Epsilon";
  `;
  expectImportOrder(input, expected, compareImports.defaultType);
});

Deno.test("namespacePresence puts namespace imports first", () => {
  const input = ts`
    import gamma from "Gamma";
    import alpha from "Alpha";
    import * as delta from "Delta";
    import * as beta from "Beta";
  `;
  const expected = ts`
    import * as delta from "Delta";
    import * as beta from "Beta";
    import gamma from "Gamma";
    import alpha from "Alpha";
  `;
  expectImportOrder(input, expected, compareImports.namespacePresence);
});

Deno.test("pathDepth orders shallower relative paths first", () => {
  const input = ts`
    import c from "PackageC";
    import d from "PackageD";
    import a from "./longer/path";
    import b from "./short-path";
  `;
  const expected = ts`
    import c from "PackageC";
    import d from "PackageD";
    import b from "./short-path";
    import a from "./longer/path";
  `;
  expectImportOrder(input, expected, compareImports.pathDepth);
});

Deno.test("pathName orders relative parent directories", () => {
  const input = ts`
    import e from "e";
    import f from "f";
    import c from "./alpha-beta/alpha/c";
    import b from "./alpha/gamma/b";
    import a from "./alpha/beta/a";
    import d from "./alpha/beta/d";
  `;
  const expected = ts`
    import e from "e";
    import f from "f";
    import a from "./alpha/beta/a";
    import d from "./alpha/beta/d";
    import b from "./alpha/gamma/b";
    import c from "./alpha-beta/alpha/c";
  `;
  expectImportOrder(input, expected, compareImports.pathName);
});

Deno.test("sideEffect puts side-effect-only imports first", () => {
  const input = ts`
    import a from "alpha";
    import "beta";
    import c from "charlie";
    import "delta";
  `;
  const expected = ts`
    import "beta";
    import "delta";
    import a from "alpha";
    import c from "charlie";
  `;
  expectImportOrder(input, expected, compareImports.sideEffect);
});

Deno.test("sourceName sorts packages and leaves relative imports in place", () => {
  const input = ts`
    import c from "./c";
    import d from "./d";
    import a from "beta";
    import b from "alpha";
  `;
  const expected = ts`
    import c from "./c";
    import d from "./d";
    import b from "alpha";
    import a from "beta";
  `;
  expectImportOrder(input, expected, compareImports.sourceName);
});

Deno.test("sourceType puts packages before relative imports", () => {
  const input = ts`
    import d from "./Delta";
    import b from "./Beta";
    import c from "Gamma";
    import a from "Alpha";
  `;
  const expected = ts`
    import c from "Gamma";
    import a from "Alpha";
    import d from "./Delta";
    import b from "./Beta";
  `;
  expectImportOrder(input, expected, compareImports.sourceType);
});

Deno.test("default declaration rules sort and group imports", () => {
  const config = new ConfigHandler();
  assert.equal(config.extractors.length, 1);
  assert.deepEqual(config.sortImports, defaultConfig.sortImports);
  assert.equal(config.sortImports[1], compareImports.sourceType);

  const input = ts`
    import local from "./z";
    import {Zoo, a, Alpha} from "beta";
    import "polyfill";
    import * as ns from "alpha";
  `;
  const expected = ts`
    import { a, Alpha, Zoo } from "beta";

    import * as ns from "alpha";

    import local from "./z";

    import "polyfill";
  `;
  expectReordered(
    input,
    expected,
    config.sortImports,
    config.sortImportElements,
    config.separateBy,
  );
});

Deno.test("default rules preserve a header and following code", () => {
  const input = ts`
    // header
    import local from "./z";
    import pkg from "pkg";

    run();
  `;
  const expected = ts`
    // header
    import pkg from "pkg";

    import local from "./z";

    run();
  `;
  const config = new ConfigHandler();
  const { sourceFile, imports } = parseImports(input);
  const sorted = new ImportSorter(config.sortImports, config.sortImportElements)
    .sort(imports);
  assert.equal(
    new ImportIntegrator(config.formatting).integrate(
      sourceFile,
      new ImportSeparator(config.separateBy).insertSeparator(sorted),
    ),
    expected,
  );
});

Deno.test("inverse reverses built-in and custom import comparators", () => {
  const input = ts`
    import a from "a";
    import b from "b";
  `;
  const expected = ts`
    import b from "b";
    import a from "a";
  `;
  const { imports } = parseImports(input);
  assert.equal(
    inverse(compareImports.sourceName)(imports[0], imports[1]) > 0,
    true,
  );
  assert.ok(inverse(compareImports.sourceType)(imports[0], imports[1]) === 0);
  expectReordered(input, expected, [inverse(compareImports.sourceName)]);
  const byName = (a: Import, b: Import) =>
    a.source.name.localeCompare(b.source.name);
  expectReordered(input, expected, [inverse(byName)]);

  const relativeImports = parseImports(ts`
    import a from "./x";
    import b from "./x/y";
  `).imports;
  assert.equal(
    compareImports.pathDepth(relativeImports[0], relativeImports[1]),
    -1,
  );
});

Deno.test("opt-in node: rule prioritizes and groups built-in imports", () => {
  const input = ts`
    import local from "./local";
    import pkg from "pkg";
    import path from "node:path";
    import fs from "node:fs";
  `;
  const expected = ts`
    import fs from "node:fs";
    import path from "node:path";

    import pkg from "pkg";

    import local from "./local";
  `;
  const config = new ConfigHandler();
  assert.equal(config.sortImports.includes(compareImports.nodePrefix), false);
  assert.equal(config.separateBy.includes(separateBy.unequalNodePrefix), false);
  const imports = parseImports(input).imports;
  assert.equal(compareImports.nodePrefix(imports[2], imports[3]), 0);
  assert.equal(compareImports.nodePrefix(imports[0], imports[1]), 0);
  expectReordered(
    input,
    expected,
    [compareImports.nodePrefix, ...config.sortImports],
    config.sortImportElements,
    [separateBy.unequalNodePrefix, ...config.separateBy],
  );
});
