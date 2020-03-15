import React, { useState, useRef } from 'react';
import { useListener } from 'relaks';

// widgets
import { Overlay } from './overlay.jsx';
import { PushButton } from './push-button.jsx';

import './font-awesome-dialog-box.scss';

export const FontAwesomeDialogBox = Overlay.create((props) => {
  const { show, iconClassName, onClose } = props;
  const [ color, setColor ] = useState(() => {
    return localStorage.iconColor || '#000000';
  });
  const [ backgroundColor, setBackgroundColor ] = useState(() => {
    return localStorage.iconBackgroundColor || '#fca326';
  });
  const urlInputRef = useRef();

  const handleColorChange = useListener((evt) => {
    const { value } = evt.target;
    setColor(value);
    localStorage.iconColor = value;
  });
  const handleBackgroundColorChange = useListener((evt) => {
    const { value } = evt.target;
    setBackgroundColor(value);
    localStorage.iconBackgroundColor = value;
  });
  const handleCopyClick = useListener((evt) => {
    const node = urlInputRef.current;
    if (node) {
      node.select();
      document.execCommand('copy');
      if (onClose) {
        onClose();
      }
    }
  });

  if (!iconClassName) {
    return null;
  }
  return (
    <div className="font-awesome-dialog-box">
      {renderForm()}
      {renderButtons()}
    </div>
  );

  /**
   * Render form
   *
   * @return {ReactElement}
   */
  function renderForm() {
    let url = `fa://${iconClassName}/${backgroundColor}`;
    if (color !== '#000000') {
      url += `/${color}`;
    }
    return (
      <div className="form">
        {renderIcon()}
        <div className="input">
          <label>Foreground color</label>
          <input type="color" value={color} onChange={handleColorChange} />
        </div>
        <div className="input">
          <label>Background color</label>
          <input type="color" value={backgroundColor} onChange={handleBackgroundColorChange} />
        </div>
        <div className="input">
          <label>URL</label>
          <input type="text" ref={urlInputRef} value={url} readOnly={true} />
        </div>
      </div>
    );
  }

  /**
   * Render icon
   *
   * @return {ReactElement}
   */
  function renderIcon() {
    const style = { color, backgroundColor };
    return (
      <div className="icon" style={style}>
        <i className={`fa ${iconClassName} fa-fw`} />
      </div>
    );
  }

  /**
   * Render buttons
   *
   * @return {ReactElement}
   */
  function renderButtons() {
    const cancelButtonProps = {
      label: 'Cancel',
      onClick: onClose,
    };
    const copyButtonProps = {
      label: 'Copy',
      emphasized: true,
      onClick: handleCopyClick,
    };
    return (
      <div className="buttons">
        <PushButton {...cancelButtonProps} />
        <PushButton {...copyButtonProps} />
      </div>
    );
  }
});
