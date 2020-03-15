import FS from 'fs';
import Path from 'path';
import Ignore from 'ignore';
import ES6 from 'es6-promisify';
import { Folder } from './folder.mjs';

const lstatAsync = ES6.promisify(FS.lstat);
const readFileAsync = ES6.promisify(FS.readFile);

export class GitIgnore {
  constructor(ignoreSets) {
    this.ignoreSets = ignoreSets;
  }

  /**
   * Return true if file should be ignored according to .gitignore
   *
   * @param  {String} path
   *
   * @return {Boolean}
   */
  match(path) {
    const name = Path.basename(path);
    if (name === '.git') {
      return true;
    }
    let ignore = false;
    for (let set of this.ignoreSets) {
      // relative to folder containing the particular .gitignore
      const relPath = Path.relative(set.path, path);
      if (set.scanner.ignores(relPath)) {
        ignore = true;
      } else if (ignore) {
        // see if a deeper-level .gitignore is overriding rules
        // imposed further up
        if (set.scanner.unignores(relPath)) {
          ignore = false;
        }
      }
    }
    return ignore;
  }

  /**
   * Load .gitignore at path and those in parent folders
   *
   * @param  {String} folderPath
   *
   * @return {Promise<Array<Object>>}
   */
  static async load(folderPath) {
    // get paths to parent folders (up to root of git working folder)
    const paths = getFolderPaths(folderPath);
    const ignoreSets = [];
    for (let path of paths) {
      const gitignore = await this.loadFile(path);
      if (gitignore) {
        ignoreSets.unshift(gitignore);
      }
    }
    return new GitIgnore(ignoreSets);
  }

  /**
   * Load .gitignore
   *
   * @param  {String} folderPath
   *
   * @return {Promise<Object>}
   */
  static async loadFile(folderPath) {
    let gitignore = this.cache[folderPath] || null;
    if (!gitignore) {
      try {
        const gitignorePath = `${folderPath}/.gitignore`;
        const stats = await lstatAsync(gitignorePath);
        const text = await readFileAsync(gitignorePath, 'utf8');
        const patterns = text.split(/[\r\n]+/);
        const scanner = Ignore().add(patterns);
        scanner.unignores = function(path) {
          const ignore = undefined;
          for (let rule of this._rules) {
            if (rule.regex.test(path)) {
              ignore = !rule.negative;
            }
          }
          return ignore === false;
        };
        gitignore = {
          path: folderPath,
          scanner: scanner,
        };
        this.cache[folderPath] = gitignore;
        return gitignore;
      } catch (err) {
      }
    }
    return gitignore;
  }

  /**
   * Find .gitignore rules from cache
   *
   * @param  {String} folderPath
   *
   * @return {Array<Object>}
   */
  static get(folderPath) {
    const paths = getFolderPaths(folderPath);
    const ignoreSets = [];
    for (let path of paths) {
      const gitignore = this.cache[path];
      if (gitignore) {
        ignoreSets.unshift(gitignore);
      }
    }
    return new GitIgnore(ignoreSets);
  }

  /**
   * Clear cached .ignore files
   *
   * @param  {String} folderPath
   *
   * @return {Boolean}
   */
  static clearCache(folderPath) {
    if (this.cache[folderPath]) {
      delete this.cache[folderPath];
      return true;
    }
    return false;
  }

  static cache = {};
}

/**
 * Return absolute path to folder and paths of its parent folders, up
 * to root of git working folder
 *
 * @param  {String} folderPath
 *
 * @return {Array<String>}
 */
function getFolderPaths(folderPath) {
  const paths = [];
  let path = folderPath;
  do {
    paths.push(path);
    const parentPath = Path.dirname(path);
    if (path !== parentPath && path !== Folder.gitRoot) {
      path = parentPath;
    } else {
      path = null;
    }
  } while (path);
  return paths;
}
