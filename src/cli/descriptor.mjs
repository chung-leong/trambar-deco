import FS from 'fs';
import Path from 'path';
import Ignore from 'ignore';
import ES6 from 'es6-promisify';
import { Folder } from './folder.mjs';

const lstatAsync = ES6.promisify(FS.lstat);
const readFileAsync = ES6.promisify(FS.readFile);

const isTrambar = /(^|\/).trambar\//;
const isRelative = /^\s*\.\.\//;

export class Descriptor {
  constructor(name, folderPath, rules, component) {
    this.name = name;
    this.folderPath = folderPath;
    this.component = component;
    this.rules = rules;

    const hierarchicalRules = [];
    const relativeRules = [];
    const trambarRules = [];
    for (let rule of rules) {
      if (rule) {
        if (isTrambar.test(rule)) {
          trambarRules.push(rule);
        } else if (isRelative.test(rule)) {
          // a rule that requires a relative path
          relativeRules.push(rule);
        } else {
          // a normal rule
          hierarchicalRules.push(rule);
        }
      }
    }
    this.matching = this.parseFnmatchRules(hierarchicalRules);
    this.matchingRelative = this.parseFnmatchRules(relativeRules);
    this.matchingTrambar = this.parseFnmatchRules(trambarRules);
  }

  /**
   * Parse rules for matching filename against patterns
   *
   * @param  {Array<String>} rules
   *
   * @return {Function|null}
   */
  parseFnmatchRules(rules) {
    // use engine for handling .gitignore files to match
    if (rules.length === 0) {
      return null;
    }
    const ignoreEngine = Ignore().add(rules);
    return (path) => {
      return ignoreEngine.ignores(path);
    };
  }

  /**
   * Check if a file matches
   *
   * @param  {File} file
   * @return {Boolean}
   */
  match(file) {
    if (this.matching) {
      if (isInFolder(file.path, this.folderPath)) {
        if (!isTrambar.test(file.path)) {
          const relativePath = Path.relative(this.folderPath, file.path);
          if (descriptor.matching(relativePath)) {
            return true;
          } else {
            return false;
          }
        }
      }
    }
    if (this.matchingRelative) {
      if (!isTrambar.test(file.path)) {
        const relativePath = Path.relative(this.folderPath, file.path);
        if (descriptor.matchingRelative(relativePath)) {
          return true;
        } else {
          return false;
        }
      }
    }
    if (descriptor.matchingTrambar) {
      if (isTrambar.test(file.path)) {
        const relativePath = Path.relative(this.folderPath, file.path);
        if (descriptor.matchingTrambar(relativePath)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Load .trambar descriptors in given folder and subfolders
   *
   * @param  {String} folderPath
   * @param  {String} path
   * @param  {String} defLangCode
   *
   * @return {Promise<Descriptor>}
   */
  static async load(folderPath, path, defLangCode) {
    let descriptor = this.cache[path];
    if (!descriptor) {
      const info = await parseDescriptorFile(path, defLangCode);
      const name = Path.basename(path).replace(/\.\w+$/, '');
      const id = `${folderPath}/${name}`;
      let iconURL = info.icon;
      if (iconURL) {
        if (!/^\w+?:/.test(iconURL)) {
          const trambarFolderPath = Path.dirname(path);
          const iconPath = `${trambarFolderPath}/${iconURL}`;
          const imageRelativePath = Path.relative(Folder.gitRoot, iconPath);
          iconURL = `images/${imageRelativePath}`;
        }
      }
      const component = new Component(id, info.descriptions, iconURL);
      const implicitRules = [ `/${name}.*` ];
      const rules = info.rules || implicitRules;
      descriptor = new Descriptor(name, folderPath, rules, component);
      this.cache[path] = descriptor;
    }
    return descriptor;
  }

  /**
   * Load .trambar descriptors in given folder and subfolders
   *
   * @param  {String} folderPath
   * @param  {String} defLangCode
   *
   * @return {Promise<Array<Descriptor>>}
   */
  static async loadAll(folderPath, defLangCode) {
    const tbFilePaths = await Folder.scan(`${folderPath}/.trambar`);
    const descriptors = [];
    for (let tbFilePath of tbFilePaths) {
      if (/\.md$/.test(tbFilePath)) {
        const descriptor = await this.load(folderPath, filePath, defLangCode);
        descriptors.push(descriptor);
      }
    }
    const childPaths = await Folder.scan(folderPath);
    for (let childPath of childPaths) {
      const stats = await lstatAsync(childPath);
      if (stats.isDirectory()) {
        if (Path.basename(childPath) === '.trambar') {
          // .trambar folder cannot be nested
          continue;
        }
        const childDescriptors = await this.loadAll(childPath, defLangCode);
        for (let childDescriptor of childDescriptors) {
          descriptors.push(childDescriptor);
        }
      }
    }
    return descriptors;
  }

  /**
   * Clear cached .trambar folders
   *
   * @param  {String} filePath
   *
   * @return {Boolean}
   */
  static clearCache(filePath) {
    if (this.cache[filePath]) {
      delete this.cache[filePath];
      return true;
    }
    return false;
  }

  static cache = {};
}

/**
 * Parse a Trambar-specific Markdown file
 *
 * @param  {String} path
 * @param  {String} defLangCode
 *
 * @return {Promise<Object>}
 */
async function parseDescriptorFile(path, defLangCode) {
  const text = await readFileAsync(path, 'utf-8');

  const parser = new MarkGor.Parser;
  const tokens = parser.parse(text);

  const languageTokens = {};
  const defaultLanguageTokens = [];
  const currentLanguageTokens = defaultLanguageTokens;
  const fileMatchDefinitions = [];
  let icon = null;

  for (let token of tokens) {
    if (token.type === 'heading') {
      let m = /^\s*\(([a-z]{2})\)/.exec(token.markdown);
      if (!m) {
        m = /^\s*([a-z]{2})\b/.exec(token.markdown);
      }
      if (m) {
        const code = m[1];
        languageTokens[code] = currentLanguageTokens = [];
        return;
      }
    } else if (token.type === 'code') {
      if (token.lang === 'fnmatch' || token.lang === 'match') {
        fileMatchDefinitions.push(token.text);
        return;
      }
    } else if (token.type === 'def') {
      if (token.name === 'icon') {
        icon = token.href;
        return;
      }
    }
    currentLanguageTokens.push(token);
  }
  if (!languageTokens[defLangCode]) {
    languageTokens[defLangCode] = defaultLanguageTokens;
  }
  const descriptions = {};
  for (let [ lang, tokens ] of Object.entries(languageTokens)) {
    const renderer = new MarkGor.JSONRenderer;
    const json = renderer.render(tokens);
    descriptions[lang] = json;
  }

  let rules = null;
  if (fileMatchDefinitions.length > 0) {
    rules = [];
    for (let patterns of fileMatchDefinitions) {
      for (let pattern of patterns.split(/[\r\n]+/)) {
        if (pattern) {
          rules.push(pattern);
        }
      }
    }
  }
  return { descriptions, rules, icon };
}

class Component {
  constructor(id, text, url) {
    this.id = id;
    this.text = text;
    if (/^fa:\/\//.test(url)) {
      // special Font-Awesome URL fa://
      const parts = url.substr(5).split('/');
      this.icon = {
        class: parts[0],
        backgroundColor: parts[1] || null,
        color: parts[2] || null,
      };
    } else if (url) {
      this.image = { url };
    }
  }
}

function isInFolder(filePath, folderPath) {
  const len = folderPath.length;
  if (filePath.substr(0, len) === folderPath) {
    if (filePath.charAt(len) === '/') {
      return true;
    }
  }
  return false;
}
