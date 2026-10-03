import assert from "node:assert/strict";

import { ConfigHandler, inverse, parseImports } from "@primp/primp";
import {
  compareImportElements,
  elementType,
} from "@primp/primp/rules/elements";

import { expectElementOrder, expectReordered, ts } from "./mod.ts";

Deno.test("basenameGroup groups uppercase names by their ending words", () => {
  const input = ts`
    import { AlphaStuff, CharlieStuff, BetaItem, deltaObject } from "pkg";
  `;
  const expected = ts`
    import { BetaItem, AlphaStuff, CharlieStuff, deltaObject } from "pkg";
  `;
  expectElementOrder(input, expected, compareImportElements.basenameGroup);

  const [alpha, charlie, beta, otherBeta, delta] = parseImports(ts`
    import { AlphaStuff, CharlieStuff, BetaItem, BetaItem as OtherBetaItem, deltaObject } from "pkg";
  `).imports[0].elements;
  const compare = compareImportElements.basenameGroup;
  assert.ok(compare(alpha, charlie) < 0);
  assert.ok(compare(alpha, beta) > 0);
  assert.ok(compare(charlie, beta) > 0);
  assert.equal(compare(beta, otherBeta), 0);
  assert.equal(compare(delta, alpha), 0);
  assert.equal(compare(alpha, delta), 0);
});

Deno.test("elementName sorts local bindings alphabetically", () => {
  const input = ts`
    import { c, a, b } from "pkg";
  `;
  const expected = ts`
    import { a, b, c } from "pkg";
  `;
  expectElementOrder(input, expected, compareImportElements.elementName);
  const [c, a, b] = parseImports(input).imports[0].elements;
  const compare = compareImportElements.elementName;
  assert.ok(compare(a, b) < 0);
  assert.ok(compare(a, c) < 0);
  assert.ok(compare(b, a) > 0);
  assert.ok(compare(b, c) < 0);
  assert.ok(compare(c, a) > 0);
  assert.ok(compare(c, b) > 0);
});

Deno.test("elementType groups lowercase names before uppercase names", () => {
  const input = ts`
    import { B, a, D, c } from "pkg";
  `;
  const expected = ts`
    import { a, c, B, D } from "pkg";
  `;
  assert.equal(elementType, compareImportElements.elementType);
  expectElementOrder(input, expected, elementType);
  const [B, a, D, c] = parseImports(input).imports[0].elements;
  assert.ok(elementType(a, B) < 0);
  assert.equal(elementType(a, c), 0);
  assert.ok(elementType(a, D) < 0);
  assert.ok(elementType(B, a) > 0);
  assert.ok(elementType(B, c) > 0);
  assert.equal(elementType(B, D), 0);
  assert.equal(elementType(c, a), 0);
  assert.ok(elementType(c, B) < 0);
  assert.ok(elementType(c, D) < 0);
  assert.ok(elementType(D, a) > 0);
  assert.equal(elementType(D, B), 0);
  assert.ok(elementType(D, c) > 0);
});

Deno.test("default specifier rule sorts Deno-style names and retains multiline commas", () => {
  const config = new ConfigHandler();
  assert.equal(
    config.sortImportElements[0],
    compareImportElements.specifierName,
  );
  const input = ts`
    import {z as a, a as z, type Zebra, type Beta, b, B, A} from 'pkg';

    import {} from 'x';
    import {alfa, bravo, charlie, delta, echo, foxtrot, golf, hotel, india} from 'phonetic';
  `;
  const expected = ts`
    import {
      alfa,
      bravo,
      charlie,
      delta,
      echo,
      foxtrot,
      golf,
      hotel,
      india,
    } from "phonetic";
    import { A, a as z, B, b, type Beta, z as a, type Zebra } from "pkg";

    import {} from "x";
  `;
  expectReordered(
    input,
    expected,
    config.sortImports,
    config.sortImportElements,
    config.separateBy,
  );
});

Deno.test("inverse reverses the named specifier comparator", () => {
  expectReordered(
    ts`import { a, b } from "pkg";`,
    ts`import { b, a } from "pkg";`,
    [],
    [inverse(compareImportElements.specifierName)],
  );
});
