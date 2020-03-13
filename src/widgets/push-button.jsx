import React from 'react';

import './push-button.scss';

export function PushButton(props) {
  const { label, hidden, disabled, emphasized, onClick } = props;
  if (hidden) {
    return null;
  }
  const classNames = [ 'push-button' ];
  if (emphasized) {
    classNames.push('emphasized');
  }
  return (
    <button className={classNames.join(' ')} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
