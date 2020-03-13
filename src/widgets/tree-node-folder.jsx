import React from 'react';

import { TreeNodeFile } from './tree-node-file.jsx';

import './tree-node-folder.scss';

export function TreeNodeFolder(props) {
  const { folder, root, onSelect } = props;
  const label = folder.path || '[ROOT]';
  return (
    <div className="tree-node-folder">
      <i className="fa fa-folder fa-fw" />
      {label} {renderWorkingFolder()}
      <div className="files">
        {folder.children.map(renderChild)}
      </div>
    </div>
  );

  /**
   * Render working folder at the root level
   *
   * @return {ReactElement|null}
   */
  function renderWorkingFolder() {
    if (!root) {
      return null;
    }
    return (
      <span className="working-folder">
        (working folder: {root})
      </span>
    );
  }

  /**
   * Render child node
   *
   * @param  {Object} child
   * @param  {Number} index
   *
   * @return {ReactElement}
   */
  function renderChild(child, index) {
    if (child.children) {
      const props = { folder: child, onSelect };
      return <TreeNodeFolder key={index} {...props} />;
    } else {
      const props = { file: child, onSelect };
      return <TreeNodeFile key={index} {...props} />;
    }
  }
}
