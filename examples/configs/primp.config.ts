import { defineConfig } from "../../mod.ts";
import dotJSFirst from "../compare_functions/imports/dotJSFirst.ts";

// Opt in to the original import order, grouping, and formatting.
export default defineConfig({
  sortImports: [
    "!sideEffect",
    "sourceType",
    "dotJSFirst",
    "!namespacePresence",
    "pathName",
    "sourceName",
  ],
  sortImportElements: ["elementType", "basenameGroup", "elementName"],
  separateBy: [
    "unequalSideEffectUse",
    "unequalPackageState",
    "unequalNamespaceUse",
  ],
  formatting: {
    indent: 2,
    bracketIndent: 0,
    quoteStyle: "double",
    maxColumns: 80,
    trailingComma: false,
    breakFrom: true,
  },
  rules: { dotJSFirst },
});
