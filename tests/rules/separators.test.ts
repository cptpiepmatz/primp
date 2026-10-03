import assert from "node:assert/strict";

import { ConfigHandler } from "@primp/primp";
import { compareImports } from "@primp/primp/rules/imports";
import { separateBy, unequalNodePrefix } from "@primp/primp/rules/separators";

import { expectReordered, expectSeparation, ts } from "./mod.ts";

Deno.test("unequalNamespaceUse separates namespace and ordinary imports", () => {
  const separator = separateBy.unequalNamespaceUse;
  expectSeparation(
    ts`
    import * as ns from "a";
    import plain from "b";
  `,
    separator,
    true,
  );
  expectSeparation(
    ts`
    import plain from "a";
    import * as ns from "b";
  `,
    separator,
    true,
  );
  expectSeparation(
    ts`
    import * as first from "a";
    import * as second from "b";
  `,
    separator,
    false,
  );
  expectSeparation(
    ts`
    import first from "a";
    import second from "b";
  `,
    separator,
    false,
  );
});

Deno.test("unequalPackageState separates packages and relative imports", () => {
  const separator = separateBy.unequalPackageState;
  expectSeparation(
    ts`
    import pkg from "pkg";
    import local from "./local";
  `,
    separator,
    true,
  );
  expectSeparation(
    ts`
    import local from "./local";
    import pkg from "pkg";
  `,
    separator,
    true,
  );
  expectSeparation(
    ts`
    import first from "a";
    import second from "b";
  `,
    separator,
    false,
  );
  expectSeparation(
    ts`
    import first from "./a";
    import second from "./b";
  `,
    separator,
    false,
  );
});

Deno.test("unequalSideEffectUse separates side effects and bindings", () => {
  const separator = separateBy.unequalSideEffectUse;
  expectSeparation(
    ts`
    import "a";
    import bound from "b";
  `,
    separator,
    true,
  );
  expectSeparation(
    ts`
    import bound from "a";
    import "b";
  `,
    separator,
    true,
  );
  expectSeparation(
    ts`
    import "a";
    import "b";
  `,
    separator,
    false,
  );
  expectSeparation(
    ts`
    import first from "a";
    import second from "b";
  `,
    separator,
    false,
  );
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
  expectReordered(
    input,
    expected,
    [compareImports.sourceType],
    [],
    [separateBy.unequalPackageState],
  );
});

Deno.test("unequalNodePrefix separates node: imports from other packages", () => {
  const config = new ConfigHandler();
  assert.deepEqual(config.separateBy, [
    separateBy.unequalSideEffectUse,
    separateBy.unequalPackageState,
    separateBy.unequalNamespaceUse,
  ]);
  assert.equal(unequalNodePrefix, separateBy.unequalNodePrefix);
  assert.equal(config.separateBy.includes(separateBy.unequalNodePrefix), false);
  expectSeparation(
    ts`
    import fs from "node:fs";
    import path from "node:path";
  `,
    unequalNodePrefix,
    false,
  );
  expectSeparation(
    ts`
    import pkg from "pkg";
    import fs from "node:fs";
  `,
    unequalNodePrefix,
    true,
  );
});
