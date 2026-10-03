import { defaultConfig, defineConfig } from "@primp/primp";
import { nodePrefix } from "@primp/primp/rules/imports";
import { unequalNodePrefix } from "@primp/primp/rules/separators";

export default defineConfig({
  sortImports: [
    nodePrefix,
    ...defaultConfig.sortImports,
  ],
  separateBy: [
    unequalNodePrefix,
    ...defaultConfig.separateBy,
  ],
});
