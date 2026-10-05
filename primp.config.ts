import {
  defaultConfig,
  defineConfig,
  jsExtractor,
  tsExtractor,
} from "@primp/primp";

import * as importComparators from "@primp/primp/rules/imports";
import * as separators from "@primp/primp/rules/separators";

export default defineConfig({
  extractors: [tsExtractor, jsExtractor],
  sortImports: [
    importComparators.nodePrefix,
    ...defaultConfig.sortImports,
  ],
  separateBy: [
    separators.nodePrefix,
    ...defaultConfig.separateBy,
  ],
});
