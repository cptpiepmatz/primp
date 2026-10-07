import { and, ConfigHandler, not, or, parseImports, xor } from "@primp/primp";
import { expect as stdExpect } from "@std/expect";

import * as separators from "@primp/primp/rules/separators";

import { expect, ts } from "./mod.ts";

Deno.test("separator combinators combine predicates at each boundary", () => {
  const { imports } = parseImports(ts`
    import "a";
    import b from "b";
    import c from "./c";
    import "d";
    import e from "e";
    import f from "f";
  `);
  // Consecutive boundaries: (true, false), (false, true),
  // (true, true), (true, false), (false, false).
  const results = (rule: typeof separators.sideEffect) =>
    imports.slice(1).map((following, index) => rule(imports[index], following));

  stdExpect(results(and(separators.sideEffect, separators.packageSource)))
    .toEqual([false, false, true, false, false]);
  stdExpect(
    results(and(separators.sideEffect, separators.packageSource, () => true)),
  )
    .toEqual([false, false, true, false, false]);
  stdExpect(results(or(separators.sideEffect, separators.packageSource)))
    .toEqual([true, true, true, true, false]);
  stdExpect(
    results(or(separators.sideEffect, separators.packageSource, () => false)),
  )
    .toEqual([true, true, true, true, false]);
  stdExpect(results(xor(separators.sideEffect, separators.packageSource)))
    .toEqual([true, true, false, true, false]);
  stdExpect(results(not(separators.sideEffect)))
    .toEqual([false, true, false, false, true]);
  stdExpect(results(and())).toEqual([true, true, true, true, true]);
  stdExpect(results(or())).toEqual([false, false, false, false, false]);
});

Deno.test("composed separator rules work in separateBy", () => {
  const input = ts`
    import "a";
    import b from "b";
    import c from "./c";
    import "d";
    import e from "e";
  `;
  const expected = ts`
    import "a";
    import b from "b";
    import c from "./c";

    import "d";
    import e from "e";
  `;

  expect(input).viaRules({
    separateBy: [and(
      separators.sideEffect,
      not(xor(
        separators.sideEffect,
        separators.packageSource,
      )),
    )],
  }).toBe(expected);
});

Deno.test("deferred separates deferred imports from other imports", () => {
  const input = ts`
    import defer * as First from "first";
    import defer * as Second from "second";
    import plain from "plain";
    import defer * as Third from "third";
  `;
  const expected = ts`
    import defer * as First from "first";
    import defer * as Second from "second";

    import plain from "plain";

    import defer * as Third from "third";
  `;

  expect(input).viaRules({ separateBy: [separators.deferred] }).toBe(expected);
});

Deno.test("importAttributes separates attributed imports from plain imports", () => {
  const input = ts`
    import json from "json" with { type: "json" };
    import legacy from "legacy" assert { type: "json" };
    import plain from "plain";
    import empty from "empty" with {};
  `;
  const expected = ts`
    import json from "json" with { type: "json" };
    import legacy from "legacy" assert { type: "json" };

    import plain from "plain";

    import empty from "empty" with {};
  `;

  expect(input).viaRules({
    separateBy: [separators.importAttributes],
  }).toBe(expected);
});

Deno.test("namespace separates namespace and ordinary imports", () => {
  const separateBy = [separators.namespace];

  const input = ts`
    import * as first from "a";
    import plain from "b";
    import other from "c";
    import * as second from "d";
    import * as third from "e";
  `;

  const expected = ts`
    import * as first from "a";

    import plain from "b";
    import other from "c";

    import * as second from "d";
    import * as third from "e";
  `;

  expect(input).viaRules({ separateBy }).toBe(expected);
});

Deno.test("packageSource separates packages and relative imports", () => {
  const separateBy = [separators.packageSource];

  const input = ts`
    import pkg from "pkg";
    import local from "./local";
    import other from "./other";
    import next from "next";
    import last from "last";
  `;

  const expected = ts`
    import pkg from "pkg";

    import local from "./local";
    import other from "./other";

    import next from "next";
    import last from "last";
  `;

  expect(input).viaRules({ separateBy }).toBe(expected);
});

Deno.test("parentPath separates parent paths from same-directory paths", () => {
  const input = ts`
    import pkg from "pkg";
    import parent from "../parent";
    import nested from "../../nested";
    import local from "./local";
    import other from "./other";
    import again from "../again";
    import next from "next";
  `;
  const expected = ts`
    import pkg from "pkg";
    import parent from "../parent";
    import nested from "../../nested";

    import local from "./local";
    import other from "./other";

    import again from "../again";
    import next from "next";
  `;

  expect(input).viaRules({ separateBy: [separators.parentPath] }).toBe(
    expected,
  );
});

Deno.test("sideEffect separates side effects and bindings", () => {
  const separateBy = [separators.sideEffect];

  const input = ts`
    import "a";
    import bound from "b";
    import other from "c";
    import "d";
    import "e";
  `;

  const expected = ts`
    import "a";

    import bound from "b";
    import other from "c";

    import "d";
    import "e";
  `;

  expect(input).viaRules({ separateBy }).toBe(expected);
});

Deno.test("typeOnly separates type-only and value imports", () => {
  const separateBy = [separators.typeOnly];

  const input = ts`
    import type { A } from "a";
    import b from "b";
    import defer * as Lazy from "lazy";
    import c from "c";
    import type { D } from "d";
    import type { E } from "e";
  `;

  const expected = ts`
    import type { A } from "a";

    import b from "b";
    import defer * as Lazy from "lazy";
    import c from "c";

    import type { D } from "d";
    import type { E } from "e";
  `;

  expect(input).viaRules({ separateBy }).toBe(expected);
});

Deno.test("nodePrefix separates node: imports from other packages", () => {
  const config = new ConfigHandler();
  stdExpect(config.separateBy).toEqual([
    separators.sideEffect,
    separators.packageSource,
    separators.namespace,
  ]);
  stdExpect(config.separateBy).not.toContain(separators.nodePrefix);

  const separateBy = [separators.nodePrefix];

  const input = ts`
    import fs from "node:fs";
    import path from "node:path";
    import pkg from "pkg";
    import other from "other";
    import url from "node:url";
  `;

  const expected = ts`
    import fs from "node:fs";
    import path from "node:path";

    import pkg from "pkg";
    import other from "other";

    import url from "node:url";
  `;

  expect(input).viaRules({ separateBy }).toBe(expected);
});

Deno.test("no separators should move all imports together", () => {
  const input = ts`
    import a from "alpha";
    import b from "beta";

    import c from "charlie";

    import d from "delta";
  `;

  const expected = ts`
    import a from "alpha";
    import b from "beta";
    import c from "charlie";
    import d from "delta";
  `;

  expect(input).viaRules({ separateBy: [] }).toBe(expected);
});

Deno.test("separator rules replace existing blank lines", () => {
  const input = ts`
    import pkg from "pkg";

    import other from "other";
    import local from "./local";
  `;

  const expected = ts`
    import pkg from "pkg";
    import other from "other";

    import local from "./local";
  `;

  expect(input).viaRules({ separateBy: [separators.packageSource] }).toBe(
    expected,
  );
});
