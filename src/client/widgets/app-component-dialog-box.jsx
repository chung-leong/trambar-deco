import React from 'react';
import { reactivate } from 'mark-gor/reactivate';

// widgets
import { Overlay } from './overlay.jsx';
import { PushButton } from './push-button.jsx';

import './app-component-dialog-box.scss';

export const AppComponentDialogBox = Overlay.create((props) => {
  const { component, languageCode, onClose } = props;
  if (!component) {
    return null;
  }
  return (
    <div className="app-component-dialog-box">
      <div className="contents">
        {renderPicture()}
        {renderText()}
      </div>
      {renderButtons()}
    </div>
  );

  /**
   * Render icon or image
   *
   * @return {ReactElement}
   */
  function renderPicture() {
    const { image, icon = {} } = component;
    if (image) {
      return (
        <div className="picture">
          <img src={image.url} />
        </div>
      );
    } else {
      const { className = 'fas fa-cubes' } = icon;
      const style = {
        color: icon.color,
        backgroundColor: icon.backgroundColor,
      };
      return (
        <div className="picture">
          <div className="icon" style={style}>
            <i className={`${className} fa-fw`} />
          </div>
        </div>
      );
    }
  }

  /**
   * Render text description of component, formatted as Markdown
   *
   * @return {ReactElement}
   */
  function renderText() {
    const classNames = [ 'text' ];
    const versions = component.text;
    let json = versions[languageCode];
    if (!json) {
      json = Object.values(versions)[0] || [];
      classNames.push('missing-language');
    }
    return (
      <div className={classNames.join(' ')}>
        {reactivate(json)}
      </div>
    );
  }

  /**
   * Render buttons
   *
   * @return {ReactElement}
   */
  function renderButtons() {
    const closeButtonProps = {
      label: 'OK',
      onClick: onClose,
    };
    return (
      <div className="buttons">
        <PushButton {...closeButtonProps} />
      </div>
    );
  }
});
