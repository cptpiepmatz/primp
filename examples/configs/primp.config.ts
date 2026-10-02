import { defineConfig, inverse } from "@primp/primp";
import {
  basenameGroup,
  elementName,
  elementType,
} from "@primp/primp/rules/elements";
import {
  namespacePresence,
  pathName,
  sideEffect,
  sourceName,
  sourceType,
} from "@primp/primp/rules/imports";
import {
  unequalNamespaceUse,
  unequalPackageState,
  unequalSideEffectUse,
} from "@primp/primp/rules/separators";
import dotJSFirst from "../compare_functions/imports/dotJSFirst.ts";

// Opt in to the original import order, grouping, and formatting.
export default defineConfig({
  sortImports: [
    inverse(sideEffect),
    sourceType,
    dotJSFirst,
    inverse(namespacePresence),
    pathName,
    sourceName,
  ],
  sortImportElements: [
    elementType,
    basenameGroup,
    elementName,
  ],
  separateBy: [
    unequalSideEffectUse,
    unequalPackageState,
    unequalNamespaceUse,
  ],
  formatting: {
    indent: 2,
    bracketIndent: 0,
    quoteStyle: "double",
    maxColumns: 80,
    trailingComma: false,
    breakFrom: true,
  },
});
