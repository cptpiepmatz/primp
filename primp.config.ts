import {
  defaultConfig,
  defineConfig,
  jsExtractor,
  tsExtractor,
} from "@primp/primp";

export default defineConfig({
  extractors: [tsExtractor, jsExtractor],
  sortImports: [
    ...defaultConfig.sortImports,
  ],
  separateBy: [
    ...defaultConfig.separateBy,
  ],
});
