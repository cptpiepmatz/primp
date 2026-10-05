import { defaultConfig, defineConfig } from "@primp/primp";
import * as importComparators from "@primp/primp/rules/imports";
import * as separators from "@primp/primp/rules/separators";

export default defineConfig({
  sortImports: [
    importComparators.nodePrefix,
    ...defaultConfig.sortImports,
  ],
  separateBy: [
    separators.nodePrefix,
    ...defaultConfig.separateBy,
  ],
});
