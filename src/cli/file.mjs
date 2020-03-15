import Path from 'path';
import { Folder } from './folder.mjs';

export class File {
  constructor(path, text) {
    this.path = path;
    this.text = text;
    this.components = null;
  }

  /**
   * Add component descriptions to files in folder
   *
   * @param  {Array<Descriptor>}
   */
  attachDescriptions(descriptors) {
    const matching = [];
    for (let descriptor of descriptors) {
      if (descriptor.match(this)) {
        matching.push(descriptor);
      }
    }
    this.components = matching.map(c => c.component);
  }

  /**
   * Export file object
   *
   * @param  {Boolean} includeComponents
   *
   * @return {Object}
   */
  exportInfo(includeComponents) {
    const object = {
      path: Path.relative(Folder.gitRoot, this.path),
      text: this.text,
    };
    if (includeComponents && this.components.length > 0) {
      object.components = this.components.map(c => c.id);
    }
    return object;
  }
}
