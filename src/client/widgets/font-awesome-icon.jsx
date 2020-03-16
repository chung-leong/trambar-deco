import React from 'react';
import { useListener } from 'relaks';

import './font-awesome-icon.scss';

export function FontAwesomeIcon(props) {
  const { prefixes, className, selected, onSelect } = props;

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
      <i className={`${prefixes[0]} ${className} fa-fw`}/>
      <div className="label">{label}</div>
    </div>
  );
}
