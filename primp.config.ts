import { defineConfig } from "./mod.ts";

export default defineConfig({
  sortImports: [
    "nodePrefix",
    "!sideEffect",
    "sourceType",
    "!namespacePresence",
    "pathName",
    "sourceName",
  ],
  separateBy: [
    "unequalNodePrefix",
    "unequalSideEffectUse",
    "unequalPackageState",
    "unequalNamespaceUse",
  ],
});
