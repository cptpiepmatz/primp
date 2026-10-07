import { extname } from "node:path";

/** A section of a file containing TypeScript or JavaScript source. */
export interface SourceSlice {
  /** Start offset in the original file (inclusive). */
  start: number;

  /** End offset in the original file (exclusive). */
  end: number;

  /** Code to parse; it may differ from the original slice after extraction. */
  content: string;
}

/** An adapter that selects files and extracts their source sections. */
export interface Extractor {
  /** Match an extension (e.g. `.vue`), a filename pattern, or a predicate. */
  extensions: string | RegExp | ((filename: string) => boolean);

  /** Extract source sections without formatting them. */
  extract(source: string, filename: string): SourceSlice[];
}

/** Test an extractor against a filename, without changing a regex's state. */
export function matchesExtractor(
  extractor: Extractor,
  filename: string,
): boolean {
  const { extensions } = extractor;
  if (typeof extensions === "string") {
    return extname(filename).toLowerCase() === extensions.toLowerCase();
  }
  if (typeof extensions === "function") return extensions(filename);
  const lastIndex = extensions.lastIndex;
  extensions.lastIndex = 0;
  try {
    return extensions.test(filename);
  } finally {
    extensions.lastIndex = lastIndex;
  }
}

/** Extract an ordinary TypeScript or JavaScript file as one whole-file slice. */
export const extractSource: Extractor["extract"] = (source) => [{
  start: 0,
  end: source.length,
  content: source,
}];

/** Built-in adapter for TypeScript source files. */
export const tsExtractor: Extractor = {
  extensions: /^(?!.*\.d\.[cm]?ts$).*\.(?:[cm]?ts|tsx)$/i,
  extract: extractSource,
};

/** Opt-in adapter for JavaScript source files. */
export const jsExtractor: Extractor = {
  extensions: /\.(?:[cm]?js|jsx)$/i,
  extract: extractSource,
};
