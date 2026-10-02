import { defineConfig } from "@primp/primp";
import { vueExtractor } from "@primp/vue";

export default defineConfig({
  extractors: [vueExtractor],
});
