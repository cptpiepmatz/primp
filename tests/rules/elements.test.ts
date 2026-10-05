import { expect } from "@std/expect";

import { ConfigHandler, inverse, parseImports } from "@primp/primp";
import * as compareImportElements from "@primp/primp/rules/elements";

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
  expect(compare(alpha, charlie)).toBeLessThan(0);
  expect(compare(alpha, beta)).toBeGreaterThan(0);
  expect(compare(charlie, beta)).toBeGreaterThan(0);
  expect(compare(beta, otherBeta)).toBe(0);
  expect(compare(delta, alpha)).toBe(0);
  expect(compare(alpha, delta)).toBe(0);
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
  expect(compare(a, b)).toBeLessThan(0);
  expect(compare(a, c)).toBeLessThan(0);
  expect(compare(b, a)).toBeGreaterThan(0);
  expect(compare(b, c)).toBeLessThan(0);
  expect(compare(c, a)).toBeGreaterThan(0);
  expect(compare(c, b)).toBeGreaterThan(0);
});

Deno.test("elementType groups lowercase names before uppercase names", () => {
  const input = ts`
    import { B, a, D, c } from "pkg";
  `;
  const expected = ts`
    import { a, c, B, D } from "pkg";
  `;
  const { elementType } = compareImportElements;
  expectElementOrder(input, expected, elementType);
  const [B, a, D, c] = parseImports(input).imports[0].elements;
  expect(elementType(a, B)).toBeLessThan(0);
  expect(elementType(a, c)).toBe(0);
  expect(elementType(a, D)).toBeLessThan(0);
  expect(elementType(B, a)).toBeGreaterThan(0);
  expect(elementType(B, c)).toBeGreaterThan(0);
  expect(elementType(B, D)).toBe(0);
  expect(elementType(c, a)).toBe(0);
  expect(elementType(c, B)).toBeLessThan(0);
  expect(elementType(c, D)).toBeLessThan(0);
  expect(elementType(D, a)).toBeGreaterThan(0);
  expect(elementType(D, B)).toBe(0);
  expect(elementType(D, c)).toBeGreaterThan(0);
});

Deno.test("default specifier rule sorts Deno-style names and retains multiline commas", () => {
  const config = new ConfigHandler();
  expect(config.sortImportElements[0]).toBe(
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
    import { a as z, A, b, B, type Beta, z as a, type Zebra } from "pkg";

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
