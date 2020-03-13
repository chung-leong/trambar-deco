import React from 'react';
import { useListener } from 'relaks';
import { parse } from 'mark-gor';

import { TreeNodeFile } from './tree-node-file.jsx';

import './app-component.scss';

export function AppComponent(props) {
  const { component, languageCode, onSelect } = props;

  const handleClick = useListener((evt) => {
    if (onSelect) {
      onSelect({ id: component.id });
    }
  });

  return (
    <div className="app-component">
      {renderDescription()}
      {renderAssociatedFiles()}
    </div>
  );

  /**
   * Render component discription
   *
   * @return {ReactElement}
   */
  function renderDescription() {
    return (
      <div className="description" onClick={handleClick}>
        {renderPicture()}
        {renderText()}
      </div>
    );
  }

  /**
   * Render icon or image
   *
   * @return {ReactElement}
   */
  function renderPicture() {
    const { image, icon = {} } = component;
    if (image) {
      var url = component.image.url;
      return (
        <div className="picture">
          <img src={url} />
        </div>
      );
    } else {
      const iconClassName = icon.class || 'fa-cubes';
      const style = {
        color: icon.color,
        backgroundColor: icon.backgroundColor,
      };
      return (
        <div className="picture">
          <div className="icon" style={style}>
            <i className={`fa fa-fw ${iconClassName}`} />
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
    const versions = component.text || {};
    const text = versions[languageCode];
    if (text === undefined) {
      text = Object.values(versions)[0] || '';
      classNames.push('missing-language');
    }
    const contents = parse(text);
    return (
      <div className={classNames.join(' ')}>
        <div className="text-contents">
          {contents}
          <div className="ellipsis">
            <i className="fa fa-ellipsis-h" />
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render list of files associated with component
   *
   * @return {ReactElement}
   */
  function renderAssociatedFiles() {
    const { files = [] } = component;
    return (
      <div className="file-list">
        {files.map(renderAssociatedFile)}
      </div>
    );
  }

  /**
   * Render one file on the list
   *
   * @param  {String} file
   * @param  {Number} index
   *
   * @return {ReactElement}
   */
  function renderAssociatedFile(file, index) {
    return <TreeNodeFile key={index} file={file} />;
  }
}
