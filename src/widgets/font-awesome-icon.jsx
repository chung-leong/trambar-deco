import React from 'react';
import { useListener } from 'relaks';

import './font-awesome-icon.scss';

export function FontAwesomeIcon(props) {
  const { className, selected, onSelect } = props;

  const handleClick = useListener((evt) => {
    if (onSelect) {
      onSelect({ className });
    }
  });

  const classNames = [ 'font-awesome-icon' ];
  if (selected) {
    classNames.push('selected');
  }
  const label = className.substr(3);
  return (
    <div className={classNames.join(' ')} onClick={handleClick} title={label}>
      <i className={`fa ${className} fa-fw`}/>
      <div className="label">{label}</div>
    </div>
  );
}

function getClassNames() {
  const classes = [];
  for (let styleSheet of document.styleSheets) {
    for (let rule of styleSheet.rules) {
      if (rule.style) {
        // don't add a class if the character employed for the
        // icon is already there
        const text = rule.style.content;
        if (text && !classes.find((c) => c.text === text)) {
          const selector = rule.selectorText;
          const matches = selector.match(/\.(fa-\S+)::before/g);
          matches.sort((a, b) => a.length - b.length);
          const first = matches[0];
          const className = first.slice(1, -8);
          classes.push({ className, text })
        }
      }
    }
  }
  classes.sort((a, b) => a.className.localeCompare(b.className));
  const names = classes.map(c => c.className);
  return names;
}

export {
  getClassNames
};
