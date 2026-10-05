import { defineConfig, inverse } from "@primp/primp";
import {
  elementName,
  lowercaseFirst,
  nameSuffix,
} from "@primp/primp/rules/elements";
import {
  directoryName,
  namespaceImport,
  packageFirst,
  sideEffect,
  sourceName,
} from "@primp/primp/rules/imports";
import * as separators from "@primp/primp/rules/separators";
import dotJSFirst from "../compare_functions/imports/dotJSFirst.ts";

// Opt in to the original import order, grouping, and formatting.
export default defineConfig({
  sortImports: [
    inverse(sideEffect),
    packageFirst,
    dotJSFirst,
    inverse(namespaceImport),
    directoryName,
    sourceName,
  ],
  sortImportElements: [
    lowercaseFirst,
    nameSuffix,
    elementName,
  ],
  separateBy: [
    separators.sideEffect,
    separators.packageSource,
    separators.namespace,
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
