import { defineConfig, inverse } from "./mod.ts";
import {
  namespacePresence,
  nodePrefix,
  pathName,
  sideEffect,
  sourceName,
  sourceType,
} from "./rules/imports.ts";
import {
  unequalNamespaceUse,
  unequalNodePrefix,
  unequalPackageState,
  unequalSideEffectUse,
} from "./rules/separators.ts";

export default defineConfig({
  sortImports: [
    nodePrefix,
    inverse(sideEffect),
    sourceType,
    inverse(namespacePresence),
    pathName,
    sourceName,
  ],
  separateBy: [
    unequalNodePrefix,
    unequalSideEffectUse,
    unequalPackageState,
    unequalNamespaceUse,
  ],
});
