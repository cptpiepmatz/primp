import { expect as stdExpect } from "@std/expect";

import { ConfigHandler } from "@primp/primp";
import * as separators from "@primp/primp/rules/separators";

import { expect, ts } from "./mod.ts";

Deno.test("unequalNamespaceUse separates namespace and ordinary imports", () => {
  const separateBy = [separators.unequalNamespaceUse];

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

Deno.test("unequalPackageState separates packages and relative imports", () => {
  const separateBy = [separators.unequalPackageState];

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

Deno.test("unequalSideEffectUse separates side effects and bindings", () => {
  const separateBy = [separators.unequalSideEffectUse];

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

Deno.test("unequalTypeOnlyUse separates type-only and value imports", () => {
  const separateBy = [separators.unequalTypeOnlyUse];

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

Deno.test("unequalNodePrefix separates node: imports from other packages", () => {
  const config = new ConfigHandler();
  stdExpect(config.separateBy).toEqual([
    separators.unequalSideEffectUse,
    separators.unequalPackageState,
    separators.unequalNamespaceUse,
  ]);
  stdExpect(config.separateBy).not.toContain(separators.unequalNodePrefix);

  const separateBy = [separators.unequalNodePrefix];

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
