import { defineConfig, inverse } from "@primp/primp";
import {
  elementName,
  lowercase,
  nameSuffix,
} from "@primp/primp/rules/elements";
import {
  directoryName,
  namespaceImport,
  packageSource,
  sideEffect,
  sourceName,
} from "@primp/primp/rules/imports";

import * as separators from "@primp/primp/rules/separators";

import dotJS from "../compare_functions/imports/dotJS.ts";

// Opt in to the original import order, grouping, and formatting.
export default defineConfig({
  sortImports: [
    inverse(sideEffect),
    packageSource,
    dotJS,
    inverse(namespaceImport),
    directoryName,
    sourceName,
  ],
  sortImportElements: [
    lowercase,
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
