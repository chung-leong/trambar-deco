import React from 'react';

import './tree-node-file.scss';

export function TreeNodeFile(props) {
  const { file, onSelect } = props;
  const { components = [] } = file;
  let icon = 'file-o';
  if (file.text) {
    icon = 'file-text-o';
  } else if (/\.(jpe?g|png|gif|svg|bmp|psd)$/i.test(file.path)) {
    icon = 'file-image-o';
  } else if (/\.pdf$/i.test(file.path)) {
    icon = 'file-pdf-o';
  }
  const classNames = [ 'tree-node-file' ];
  if (components.length > 0) {
    classNames.push('decorated');
  }
  return (
    <div className={classNames.join(' ')}>
      <i className={`fa fa-fw fa-${icon}`} />
      {file.path}
      {renderComponentBadges()}
    </div>
  );

  function renderComponentBadges() {
    if (!onSelect) {
      return null;
    }
    const { components = [] } = file;
    const badges = components.map((id, index) => {
      const handleClick = (evt) => { onSelect({ id }) };
      return (
        <div key={index} className="badge" onClick={handleClick}>
          {index + 1}
        </div>
      );
    });
    if (badges.length === 0) {
      return null;
    }
    return <div className="badges">{badges}</div>;
  }
}
