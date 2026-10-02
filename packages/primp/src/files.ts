import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { SourceFile } from "typescript";

import { parseImports } from "./core.ts";
import type { Import } from "./core.ts";
import { matchesExtractor, tsExtractor } from "./extractors.ts";

/** A manager for loading and writing TypeScript source files. */
export class FileManager {
  /** Source files and their leading imports, keyed by absolute path. */
  readonly imports: Map<
    string,
    { sourceFile: SourceFile; imports: Import[] }
  > = new Map();

  /**
   * Load one or more source files.
   *
   * Each file is read immediately and its leading imports are parsed.
   *
   * @param paths Source file path or paths to load.
   */
  constructor(paths: string | string[]) {
    for (const path of Array.isArray(paths) ? paths : [paths]) {
      this.reloadFromDisk(path);
    }
  }

  /**
   * Reload a source file from disk.
   *
   * Replace its cached syntax tree and leading imports.
   *
   * @param path File path to reload.
   */
  reloadFromDisk(path: string): void {
    const fullPath = resolve(path);
    this.imports.set(
      fullPath,
      parseImports(readFileSync(fullPath, "utf8"), fullPath),
    );
  }

  /**
   * Write a loaded source file's updated content.
   *
   * Write in place or to `newPath`, creating parent directories as needed.
   * Reuse the source file's first newline style, defaulting to LF; skip an
   * in-place write when the content is unchanged.
   *
   * @param path Previously loaded source file path.
   * @param content Text to write.
   * @param newPath Optional destination path; defaults to the source path.
   * @throws If the source path was not previously loaded.
   */
  write(path: string, content: string, newPath?: string): void {
    const original = this.imports.get(resolve(path))?.sourceFile.text;
    if (original === undefined) throw new Error(`File not loaded: ${path}`);
    const target = newPath ?? path;
    const newline = original.match(/\r\n|\n|\r/)?.[0] ?? "\n";
    const normalized = content.replace(/\r\n|\n|\r/g, newline);
    if (target === path && normalized === original) return;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, normalized);
  }

  /**
   * Find files supported by the configured extractors at a path.
   *
   * Return a matching explicit file directly, or an empty array if unmatched.
   * In a directory, collect matching files, descending into subdirectories
   * only when `recursive` is true. Missing paths throw.
   *
   * @param path File or directory to inspect.
   * @param recursive Whether to descend into subdirectories.
   * @param matchesFile Matcher for files supported by extractors.
   * @returns The file path itself, or an array of matching paths in a directory.
   */
  static getFiles(
    path: string,
    recursive = false,
    matchesFile: (filename: string) => boolean = (filename) =>
      matchesExtractor(tsExtractor, filename),
  ): string | string[] {
    const stat = statSync(path);
    if (stat.isFile()) return matchesFile(resolve(path)) ? path : [];
    if (!stat.isDirectory()) {
      throw new Error(`Not a file or directory: ${path}`);
    }
    const files: string[] = [];
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      const info = statSync(child);
      if (info.isDirectory() && recursive) {
        files.push(
          ...[FileManager.getFiles(child, true, matchesFile)]
            .flat(),
        );
      } else if (
        info.isFile() &&
        matchesFile(resolve(child))
      ) files.push(child);
    }
    return files;
  }
}
