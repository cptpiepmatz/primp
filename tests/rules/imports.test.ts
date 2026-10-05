import { ConfigHandler, defaultConfig, inverse } from "@primp/primp";
import { expect as stdExpect } from "@std/expect";
import * as compareImports from "@primp/primp/rules/imports";
import * as separators from "@primp/primp/rules/separators";

import type { Import } from "@primp/primp";

import { expect, ts } from "./mod.ts";

Deno.test("defaultImport puts imports with default bindings first", () => {
  const sortImports = [compareImports.defaultImport];

  const input = ts`
    import {stuff} from "things";
    import {a, b, c} from "alpha";
    import d, {e, f} from "beta";
    import random from "weird";
  `;

  const expected = ts`
    import d, { e, f } from "beta";
    import random from "weird";
    import { stuff } from "things";
    import { a, b, c } from "alpha";
  `;

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("uppercaseDefault orders uppercase defaults before lowercase defaults", () => {
  const sortImports = [compareImports.uppercaseDefault];

  const input = ts`
    import { gamma } from "Gamma";
    import alpha from "Alpha";
    import Beta from "Beta";
    import Delta from "Delta";
    import epsilon from "Epsilon";
  `;

  const expected = ts`
    import { gamma } from "Gamma";
    import Beta from "Beta";
    import Delta from "Delta";
    import alpha from "Alpha";
    import epsilon from "Epsilon";
  `;

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("namespaceImport puts namespace imports first", () => {
  const sortImports = [compareImports.namespaceImport];

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

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("pathDepth orders shallower relative paths first", () => {
  const sortImports = [compareImports.pathDepth];

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

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("directoryName orders relative parent directories", () => {
  const sortImports = [compareImports.directoryName];

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

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("parentPath puts parent paths ahead of same-directory paths", () => {
  const input = ts`
    import pkg from "pkg";
    import local from "./local";
    import parent from "../parent";
    import nested from "../../nested";
    import other from "./other";
  `;
  const expected = ts`
    import pkg from "pkg";
    import parent from "../parent";
    import nested from "../../nested";
    import local from "./local";
    import other from "./other";
  `;

  expect(input).viaRules({ sortImports: [compareImports.parentPath] }).toBe(
    expected,
  );
});

Deno.test("deferred puts deferred imports ahead of other declarations", () => {
  const input = ts`
    import value from "value";
    import defer * as Lazy from "lazy";
    import type { Model } from "types";
    import defer * as Other from "other";
  `;
  const expected = ts`
    import defer * as Lazy from "lazy";
    import defer * as Other from "other";
    import value from "value";
    import type { Model } from "types";
  `;

  expect(input).viaRules({ sortImports: [compareImports.deferred] }).toBe(
    expected,
  );
});

Deno.test("importAttributes groups with and assert clauses, including empty ones", () => {
  const input = ts`
    import plain from "plain";
    import json from "json" with { type: "json" };
    import other from "other";
    import legacy from "legacy" assert { type: "json" };
    import empty from "empty" with {};
  `;
  const expected = ts`
    import json from "json" with { type: "json" };
    import legacy from "legacy" assert { type: "json" };
    import empty from "empty" with {};
    import plain from "plain";
    import other from "other";
  `;

  expect(input).viaRules({
    sortImports: [compareImports.importAttributes],
  }).toBe(expected);
});

Deno.test("sideEffect puts side-effect-only imports first", () => {
  const sortImports = [compareImports.sideEffect];

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

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("sourceName sorts packages and leaves relative imports in place", () => {
  const sortImports = [compareImports.sourceName];

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

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("packageFirst puts packages before relative imports", () => {
  const sortImports = [compareImports.packageFirst];

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

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("custom source grouping puts a blank line between packages and local imports", () => {
  const input = ts`
    import a from "./a";
    import b from "b";
  `;

  const expected = ts`
    import b from "b";

    import a from "./a";
  `;

  expect(input).viaRules({
    sortImports: [compareImports.packageFirst],
    separateBy: [separators.packageSource],
  }).toBe(expected);
});

Deno.test("typeOnly puts type-only declarations before other imports", () => {
  const sortImports = [compareImports.typeOnly];

  const input = ts`
    import { type Inline } from "inline";
    import type { Named } from "named";
    import value from "value";
    import defer * as Lazy from "lazy";
    import type Default from "default";
    import "side-effect";
    import type * as Namespace from "namespace";
  `;

  const expected = ts`
    import type { Named } from "named";
    import type Default from "default";
    import type * as Namespace from "namespace";
    import { type Inline } from "inline";
    import value from "value";
    import defer * as Lazy from "lazy";
    import "side-effect";
  `;

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("default declaration rules sort and group imports", () => {
  const config = new ConfigHandler();
  stdExpect(config.extractors).toHaveLength(1);
  stdExpect(config.sortImports).toEqual(defaultConfig.sortImports);
  stdExpect(config.sortImports[1]).toBe(compareImports.packageFirst);

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

  expect(input).viaRules(config).toBe(expected);
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
  expect(input).viaRules(config).toBe(expected);
});

Deno.test("inverse reverses the source name sorter", () => {
  const sortImports = [inverse(compareImports.sourceName)];

  const input = ts`
    import a from "a";
    import b from "b";
  `;

  const expected = ts`
    import b from "b";
    import a from "a";
  `;

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("inverse puts relative imports first without reordering packages", () => {
  const sortImports = [inverse(compareImports.packageFirst)];

  const input = ts`
    import first from "a";
    import local from "./local";
    import second from "b";
  `;

  const expected = ts`
    import local from "./local";
    import first from "a";
    import second from "b";
  `;

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("inverse reverses a custom import sorter", () => {
  const byName = (a: Import, b: Import) =>
    a.source.name.localeCompare(b.source.name);
  const sortImports = [inverse(byName)];

  const input = ts`
    import a from "a";
    import b from "b";
  `;

  const expected = ts`
    import b from "b";
    import a from "a";
  `;

  expect(input).viaRules({ sortImports }).toBe(expected);
});

Deno.test("node: import rules are opt-in", () => {
  const config = new ConfigHandler();
  stdExpect(config.sortImports).not.toContain(compareImports.nodePrefix);
  stdExpect(config.separateBy).not.toContain(separators.nodePrefix);
});

Deno.test("opt-in node: rule prioritizes and groups built-in imports", () => {
  const config = new ConfigHandler();
  const sortImports = [compareImports.nodePrefix, ...config.sortImports];
  const separateBy = [separators.nodePrefix, ...config.separateBy];

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

  expect(input).viaRules({
    sortImports,
    sortImportElements: config.sortImportElements,
    separateBy,
  }).toBe(expected);
});
