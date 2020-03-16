import FS from 'fs';
import ES6 from 'es6-promisify';
import { Folder } from './folder.mjs';

const readFileAsync = ES6.promisify(FS.readFile);

export class FAIconLibrary {
  constructor(icons) {
    this.icons = icons;
  }

  static async load() {
    if (this.cache) {
      return this.cache;
    }
    const iconSets = await FAIconSet.loadAll();
    const faClasses = await this.scanCSSFiles();
    const icons = [];
    for (let faClass of faClasses) {
      const { charCode, className } = faClass;
      const prefixes = [];
      for (let iconSet of iconSets) {
        if (iconSet.match(charCode)) {
          prefixes.push(iconSet.prefix);
        }
      }
      if (prefixes.length > 0) {
        icons.push({ prefixes, className });
      }
    }
    const library = new FAIconLibrary(icons);
    this.cache = library;
    return library;
  }

  static async scanCSSFiles() {
    const wwwFolder = Folder.findWWW();
    const files = await Folder.scan(wwwFolder);
    const faClasses = [];
    const found = {};
    for (let file of files) {
      if (/\.css$/i.test(file)) {
        const faClassesinFile = await this.scanCSSFile(file);
        for (let faClass of faClassesinFile) {
          if (!found[faClass.className]) {
            faClasses.push(faClass);
            found[faClass.className] = true;
          }
        }
      }
    }
    return faClasses;
  }

  static async scanCSSFile(cssPath) {
    const text = await readFileAsync(cssPath, 'utf-8');
    const faClasses = [];
    const re = /\.(fa-[\w\-]+?):before\s*{\s*content:\s*"\\(\w+)";\s*}/g;
    let m;
    while (m = re.exec(text)) {
      const className = m[1];
      const charCode = parseInt(m[2], 16);
      faClasses.push({ className, charCode });
    }
    return faClasses;
  }

  static cache;
}

class FAIconSet {
  constructor(prefix, cmap) {
    this.prefix = prefix;
    this.cmap = cmap;
  }

  match(charCode) {
    return this.cmap[charCode];
  }

  static async load(ttfPath) {
    const buffer = await readFileAsync(ttfPath);
    const tables = extractTTFTables(buffer);
    const nameBuf = tables['name'];
    const name = extractName(nameBuf);
    const cmapBuf = tables['cmap'];
    const cmap = extractUnicodeCoverage(cmapBuf);
    let prefix;
    if (/Brands/.test(name)) {
      prefix = 'fab';
    } else if (/Solid/.test(name)) {
      prefix = 'fas';
    } else if (/Regular/.test(name)) {
      prefix = 'far';
    }
    if (prefix) {
      return new FAIconSet(prefix, cmap);
    }
  }

  static async loadAll() {
    const wwwFolder = Folder.findWWW();
    const files = await Folder.scan(wwwFolder);
    const iconSets = [];
    for (let file of files) {
      if (/\.ttf$/i.test(file)) {
        const iconSet = await this.load(file);
        if (iconSet) {
          iconSets.push(iconSet);
        }
      }
    }
    iconSets.sort((a, b) => b.prefix.localeCompare(a.prefix));
    return iconSets;
  }
}

function extractTTFTables(buffer) {
  const version = buffer.readUInt32BE(0);
  const numTables = buffer.readUInt16BE(4);
  const tables = {};
  for (let i = 0, offset = 12; i < numTables; i++, offset += 16) {
    const tag = buffer.slice(offset, offset + 4).toString();
    const tableOffset = buffer.readUInt32BE(offset + 8);
    const tableLength = buffer.readUInt32BE(offset + 12);
    tables[tag] = buffer.slice(tableOffset, tableOffset + tableLength);
  }
  return tables;
}

function extractName(nameBuf) {
  const numRecords = nameBuf.readUInt16BE(2);
  const dataOffset = nameBuf.readUInt16BE(4);
  for (let i = 0, offset = 6; i < numRecords; i++, offset += 12) {
    const nameId = nameBuf.readUInt16BE(offset + 6);
    const nameLength = nameBuf.readUInt16BE(offset + 8);
    const nameOffset = dataOffset + nameBuf.readUInt16BE(offset + 10);
    if (nameId === 6) {
      const strBuf = nameBuf.slice(nameOffset, nameOffset + nameLength);
      const name = strBuf.toString('ascii');
      return name;
    }
  }
}

function extractUnicodeCoverage(cmapBuf) {
  const numEncodings = cmapBuf.readUInt16BE(2);
  let format4Buf = null;
  for (let i = 0, offset = 4; i < numEncodings; i++, offset += 8) {
    const platformId = cmapBuf.readUInt16BE(offset);
    const encodingId = cmapBuf.readUInt16BE(offset + 2);
    const encodingOffset = cmapBuf.readUInt32BE(offset + 4);
    if (platformId === 3 && encodingId === 1) {
      const formatId = cmapBuf.readUInt16BE(encodingOffset);
      if (formatId === 4) {
        const formatLength = cmapBuf.readUInt16BE(encodingOffset + 2);
        format4Buf = cmapBuf.slice(encodingOffset, encodingOffset + formatLength);
        break;
      }
    }
  }

  const segCountX2 = format4Buf.readUInt16BE(6);
  const segCount = segCountX2 >> 1;
  const coverage = [];
  for (let i = 0, ecOffset = 14; i < segCount; i++, ecOffset += 2) {
    const endCode = format4Buf.readUInt16BE(ecOffset);
    const startCode = format4Buf.readUInt16BE(ecOffset + 2 + segCountX2);
    if (endCode !== 0xffff) {
      for (let c = startCode; c <= endCode; c++) {
        coverage[c] = true;
      }
    }
  }
  return coverage;
}
