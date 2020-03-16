import FS from 'fs';
import Path from 'path';
import Ignore from 'ignore';
import ES6 from 'es6-promisify';
import URL from 'url';
import { GitIgnore } from './git-ignore.mjs';
import { File } from './file.mjs';
import { Descriptor } from './descriptor.mjs';

const lstatAsync = ES6.promisify(FS.lstat);
const readdirAsync = ES6.promisify(FS.readdir);
const openAsync = ES6.promisify(FS.open);
const readAsync = ES6.promisify(FS.read);
const closeAsync = ES6.promisify(FS.close);

export class Folder {
  constructor(path, children) {
    this.path = path;
    this.children = children;
  }

  /**
   * Add component descriptions to files in folder
   *
   * @param  {Array<Descriptor>}
   */
  attachDescriptions(descriptors) {
    for (let child of this.children) {
      child.attachDescriptions(descriptors);
    }
  }

  /**
   * Export folder info
   *
   * @param  {Boolean} includeComponents
   *
   * @return {Object}
   */
  exportInfo(includeComponents) {
    return {
      path: Path.relative(Folder.gitRoot, this.path),
      children: this.children.map(c => c.exportInfo(includeComponents)),
    };
  }

  /**
   * Export component descriptions
   *
   * @param  {Folder} folder
   *
   * @return {Array<Object>}
   */
  exportComponents(folder) {
    // get a list of all files
    const files = [];
    const collectFiles = (folder, list) => {
      for (let child of folder.children) {
        if (child instanceof Folder) {
          collectFiles(child, list);
        } else {
          list.push(child);
        }
      }
    }
    collectFiles(this, files);
    files.sort((a, b) => String.localeCompare(a.path, b.path));

    // create a map connecting files to components
    const componentFileLists = new WeakMap;
    for (let file of files) {
      for (let component of file.components) {
        const fileList = componentFileLists.get(component);
        if (!fileList) {
          fileList = [];
          componentFileLists.set(component, fileList);
        }
        fileList.push(file);
      }
    }

    // attach file list to components
    const components = [];
    for (let file of files) {
      for (let component of file.components) {
        const fileList = componentFileLists.get(component);
        const componentEx = { ...component };
        componentEx.files = fileList.map(file => exportFile(file, false));
        components.push(componentEx);
      }
    }
    return components;
  }

  /**
   * Look for files and their descriptoin in selected folders
   *
   * @param  {String} defLangCode
   *
   * @return {Promise<Folder>}
   */
  static async describeCurrent(defLangCode) {
    const currentFolderPath = Path.resolve('.');
    const folder = await this.find(currentFolderPath);
    const descriptors = await Descriptor.loadAll(Folder.gitRoot, defLangCode);
    folder.attachDescriptions(descriptors);
    return folder;
  }

  /**
   * Scan for files in a folder
   *
   * @param  {String} folderPath
   *
   * @return {Promise<Folder>}
   */
  static async find(folderPath) {
    const childPaths = await this.scan(folderPath);
    const children = [];
    for (let childPath of childPaths) {
      try {
        const stats = await lstatAsync(childPath);
        if (stats.isDirectory()) {
          const name = Path.basename(childPath);
          if (name !== '.git') {
            const subfolder = this.find(childPath);
            children.push(subfolder);
          }
        } else {
          const text = await isTextFile(childPath);
          const file = new File(childPath, text);
          children.push(file);
        }
      } catch (err) {
        // probably because the file is not longer there
        // when a file is moved, we receive an add event
        // then a unlink event; the first event could
        // trigger a scan before the second link clear
        // the cache used by scanFolder()
      }
      return new Folder(folderPath, children);
    }
  }

  /**
   * Scan a folder, taking into account rules in .gitignore files
   *
   * @param  {String} folderPath
   *
   * @return {Promise<Array<String>>}
   */
  static async scan(folderPath) {
    let listing = this.cache[folderPath];
    if (!listing) {
      listing = [];
      const gitignore = await GitIgnore.load(folderPath);
      try {
        const childNames = await readdirAsync(folderPath);
        for (let childName of childNames) {
          const childPath = Path.join(folderPath, childName);
          if (!gitignore.match(childPath)) {
            listing.push(childPath);
          }
        }
      } catch (err) {
      }
      this.cache[folderPath] = listing;
    }
    return listing;
  }

  /**
   * Look for git folder that the given folder is contained in
   *
   * @return {String|null}
   */
  static findGitRoot() {
    let path = Path.resolve('.');
    do {
      if (FS.existsSync(`${path}/.git`)) {
        break;
      }
      const parentPath = Path.dirname(path);
      if (path !== parentPath) {
        path = parentPath;
      } else {
        path = null;
      }
    } while (path);
    this.gitRoot = path;
    return path;
  }

  /**
   * Look for folder holding client files
   *
   * @return {String|null}
   */
  static findWWW() {
    const scriptPath = URL.fileURLToPath(import.meta.url);
    let path = Path.dirname(scriptPath);
    do {
      if (FS.existsSync(`${path}/package.json`)) {
        break;
      }
      const parentPath = Path.dirname(path);
      if (path !== parentPath) {
        path = parentPath;
      } else {
        path = null;
      }
    } while (path);
    return (path) ? `${path}/bin/www` : null;
  }

  /**
   * Clear folder cache
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

  static rootPath;
  static cache = {};
}

/**
 * Check if a file contains text
 *
 * @param  {String} path
 *
 * @return {Promise<Boolean>}
 */
async function isTextFile(path) {
  const fd = await openAsync(path, 'r');
  let isText = true;
  try {
    const buffer = new Buffer.alloc(1024);
    const len = await readAsync(fd, buffer, 0, buffer.length, 0);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < len; i++) {
      if (bytes[i] === 0) {
        isText = false;
      }
    }
  } catch (err) {
    console.log(err.message);
    isText = false;
  } finally {
    closeAsync(fd);
  }
  return isText;
}
