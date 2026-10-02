import { defineConfig, inverse } from "@primp/primp";
import {
  namespacePresence,
  nodePrefix,
  pathName,
  sideEffect,
  sourceName,
  sourceType,
} from "@primp/primp/rules/imports";
import {
  unequalNamespaceUse,
  unequalNodePrefix,
  unequalPackageState,
  unequalSideEffectUse,
} from "@primp/primp/rules/separators";

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
