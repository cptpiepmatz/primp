import { expect as stdExpect } from "@std/expect";

import { ConfigHandler, inverse } from "@primp/primp";
import * as compareImportElements from "@primp/primp/rules/elements";

import { expect, ts } from "./mod.ts";

Deno.test("basenameGroup groups uppercase names by their ending words", () => {
  const sortImportElements = [compareImportElements.basenameGroup];

  const input = ts`
    import {
      AlphaStuff,
      CharlieStuff,
      BetaItem,
      BetaItem as OtherBetaItem,
      deltaObject,
    } from "pkg";
  `;

  const expected = ts`
    import {
      BetaItem,
      BetaItem as OtherBetaItem,
      AlphaStuff,
      CharlieStuff,
      deltaObject,
    } from "pkg";
  `;

  expect(input).viaRules({ sortImportElements }).toBe(expected);
});

Deno.test("elementName sorts local bindings alphabetically", () => {
  const sortImportElements = [compareImportElements.elementName];

  const input = ts`
    import { a as z, c, z as a, b } from "pkg";
  `;

  const expected = ts`
    import { z as a, b, c, a as z } from "pkg";
  `;

  expect(input).viaRules({ sortImportElements }).toBe(expected);
});

Deno.test("elementType groups lowercase names before uppercase names", () => {
  const sortImportElements = [compareImportElements.elementType];

  const input = ts`
    import { B, a, D, c } from "pkg";
  `;

  const expected = ts`
    import { a, c, B, D } from "pkg";
  `;

  expect(input).viaRules({ sortImportElements }).toBe(expected);
});

Deno.test("specifierName sorts original names without regard to case", () => {
  const sortImportElements = [compareImportElements.specifierName];

  const input = ts`
    import { z as a, B, a as z, b } from "pkg";
  `;

  const expected = ts`
    import { a as z, B, b, z as a } from "pkg";
  `;

  expect(input).viaRules({ sortImportElements }).toBe(expected);
});

Deno.test("default specifier rule sorts Deno-style names and retains multiline commas", () => {
  const config = new ConfigHandler();
  stdExpect(config.sortImportElements[0]).toBe(
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
  expect(input).viaRules(config).toBe(expected);
});

Deno.test("inverse reverses the named specifier comparator", () => {
  const sortImportElements = [inverse(compareImportElements.specifierName)];

  const input = ts`
    import { a, b } from "pkg";
  `;

  const expected = ts`
    import { b, a } from "pkg";
  `;

  expect(input).viaRules({ sortImportElements }).toBe(expected);
});
