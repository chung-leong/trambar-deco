import React, { useState, useMemo, useEffect } from 'react';
import { useListener, useAsyncEffect, useEventTime } from 'relaks';
import SockJS from 'sockjs-client';

// widgets
import { AppComponent } from './widgets/app-component.jsx';
import { AppComponentDialogBox } from './widgets/app-component-dialog-box.jsx';
import { TreeNodeFolder } from './widgets/tree-node-folder.jsx';
import { FontAwesomeIcon } from './widgets/font-awesome-icon.jsx';
import { FontAwesomeDialogBox } from './widgets/font-awesome-dialog-box.jsx';

import '@fortawesome/fontawesome-free/css/all.css';
import './application.scss';

export function Application(props) {
  const [ view, setView ] = useState(getViewFromHash);
  const [ data, setData ] = useState({
    folder: { children: [] },
    components: [],
    icons: [],
  });
  const [ availableLanguages, setAvailableLanguages ] = useState([]);
  const [ languageCode, setLanguageCode ] = useState(() => {
    return localStorage.languageCode || getBrowserLanguage();
  });
  const [ dialog, setDialog ] = useState(false);
  const [ reconnect, setReconnect ] = useEventTime();
  const [ dataChanged, setDataChanged ] = useEventTime();
  const components = useMemo(() => {
    const { components } = data;
    components.sort((a, b) => {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    return components;
  }, [ data ]);
  const { icons } = data;

  const handleComponentSelect = useListener((evt) => {
    const { id } = evt;
    setDialog({ type: 'component', id });
  });
  const handleIconSelect = useListener((evt) => {
    const { className } = evt;
    setDialog({ type: 'icon', className });
  });
  const handleLanguageClick = useListener((evt) => {
    const { lang } = evt.currentTarget;
    localStorage.languageCode = lang;
    setLanguageCode(lang);
  });
  const handleDialogClose = useListener((evt) => {
    setDialog(null);
  });
  const handleButtonClick = useListener((evt) => {
    const hash = evt.currentTarget.getAttribute('href');
    setView(hash.substr(1));
    history.pushState({}, '', hash);
    evt.preventDefault();
  });
  const handlePopState = useListener((evt) => {
    const view = getViewFromHash();
    setView(view);
  });

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
  useEffect(() => {
    const socket = new SockJS('socket');
    socket.onmessage = (evt) => {
      if (evt.data === 'change') {
        setDataChanged();
      }
    };
    socket.onclose = () => {
      setTimeout(setReconnect, 5000);
    };
  }, [ reconnect ]);
  useAsyncEffect(async () => {
    const res = await fetch('data');
    const data = await res.json();
    setData(data);

    const availableLanguages = [];
    for (let component of data.components) {
      for (let [ code ] of Object.keys(component.text)) {
        if (!availableLanguages.indexOf(code)) {
          availableLanguages.push(code);
        }
      }
    }
    availableLanguages.sort();
    setAvailableLanguages(availableLanguages);

    if (availableLanguages.indexOf(languageCode) === -1) {
      if (availableLanguages.length > 0) {
        setLanguageCode(availableLanguages[0])
      }
    }
  }, [ dataChanged ]);

  return (
    <div className="application">
      {renderSideNavigation()}
      {renderContents()}
    </div>
  );

  /**
   * Render side navigation
   *
   * @return {ReactElement}
   */
  function renderSideNavigation() {
    const componentsProps = {
      iconClass: 'fas fa-cubes',
      selected: (view === 'components'),
      title: 'Components',
      url: '#components',
      onClick: handleButtonClick,
    };
    const sourceTreeProps = {
      iconClass: 'far fa-copy',
      selected: (view === 'source-tree'),
      title: 'Source tree',
      url: '#source-tree',
      onClick: handleButtonClick,
    };
    const iconsProps = {
      iconClass: 'fas fa-flag',
      selected: (view === 'icons'),
      title: 'Font Awesome icons',
      url: '#icons',
      onClick: handleButtonClick,
    };
    return (
      <div className="side-navigation">
        <SideButton {...componentsProps} />
        <SideButton {...sourceTreeProps} />
        <SideButton {...iconsProps} />
        {renderLanguageButtons()}
      </div>
    );
  }

  /**
   * Render currently selected view
   *
   * @return {ReactElement}
   */
  function renderContents() {
    switch (view) {
      case 'components': return renderComponents();
      case 'source-tree': return renderSourceTree();
      case 'icons': return renderIcons();
    }
  }

  /**
   * Render list of components
   *
   * @return {ReactElement}
   */
  function renderComponents() {
    return (
      <div className="page-view-port">
        <div className="components">
          {components.map(renderComponent)}
        </div>
        {renderComponentDialogBox()}
      </div>
    );
  }

  /**
   * Render individual component
   *
   * @param  {Object} component
   * @param  {Number} index
   *
   * @return {ReactElement}
   */
  function renderComponent(component, index) {
    const props = {
      key: index,
      component,
      languageCode,
      onSelect: handleComponentSelect,
    };
    return <AppComponent {...props} />;
  }

  /**
   * Render source tree
   *
   * @return {ReactElement}
   */
  function renderSourceTree() {
    const { folder, root } = data;
    const props = {
      folder,
      root,
      onSelect: handleComponentSelect,
    };
    return (
      <div className="page-view-port">
        <TreeNodeFolder {...props} />;
        {renderComponentDialogBox()}
      </div>
    );
  }

  function renderComponentDialogBox() {
    const show = (dialog && dialog.type === 'component');
    const component = (show) ? components.find(c => c.id === dialog.id) : null;
    const props = {
      show,
      component,
      languageCode,
      onClose: handleDialogClose,
    };
    return <AppComponentDialogBox {...props} />;
  }

  /**
   * Render list of Font Awesome icons
   *
   * @return {ReactElement}
   */
  function renderIcons() {
    return (
      <div className="page-view-port">
        {icons.map(renderIcon)}
        {renderIconDialogBox()}
      </div>
    );
  }

  /**
   * Render Font Awesome icon
   *
   * @param  {Object} icon
   * @param  {Number} index
   *
   * @return {ReactElement}
   */
  function renderIcon(icon, index) {
    const { prefixes, className } = icon;
    const show = (dialog && dialog.type === 'icon');
    const props = {
      key: index,
      prefixes,
      className,
      selected: (show) ? dialog.className === className : false,
      onSelect: handleIconSelect,
    };
    return <FontAwesomeIcon {...props} />
  }

  /**
   * Render icon dialog box
   *
   * @return {ReactElement}
   */
  function renderIconDialogBox() {
    const show = (dialog && dialog.type === 'icon');
    const icon = (show) ? icons.find(i => i.className === dialog.className) : null
    const props = {
      show,
      icon,
      onClose: handleDialogClose,
    };
    return <FontAwesomeDialogBox {...props} />;
  }

  /**
   * Render buttons for selecting language
   *
   * @return {ReactElement}
   */
  function renderLanguageButtons() {
    return (
      <div className="language-buttons">
        {availableLanguages.map(renderLanguageButton)}
      </div>
    );
  }

  /**
   * Render a language button for selecting language
   *
   * @return {ReactElement}
   */
  function renderLanguageButton(code, index) {
    const classNames = [ 'language-button' ];
    if (code === languageCode) {
      classNames.push('selected');
    }
    return (
      <div key={code} classNames={classNames.push} lang={code} onClick={handleLanguageClick}>
        {code}
      </div>
    );
  }
}

function SideButton(props) {
  const { selected, title, url, iconClass, onClick} = props;
  const classNames = [ 'button' ];
  if (selected) {
    classNames.push('selected');
  }
  return (
    <a className={classNames.join(' ')} href={url} title={title} onClick={onClick}>
      <i className={`${iconClass} fa-fw`} />
    </a>
  );
}

/**
 * Get current view from URL hash
 *
 * @return {String}
 */
function getViewFromHash() {
  switch (location.hash) {
    case '#icons': return 'icons';
    case '#source-tree': return 'source-tree';
    case '#components':
    default: return 'components';
  }
}

/**
 * Get language setting of browser
 *
 * @return {String}
 */
function getBrowserLanguage() {
  // check navigator.languages
  const list = (navigator.languages || []).slice();

  // check other fields as well
  const keys = [ 'language', 'browserLanguage', 'systemLanguage', 'userLanguage' ];
  for (let key of keys) {
    list.push(navigator[key]);
  }

  for (let lang of list) {
    if (lang && lang.length >= 2) {
      return lang.substr(0, 2).toLowerCase();
    }
  }
  return 'en';
}

if (process.env.NODE_ENV !== 'production') {
  require('./widgets/__PROPTYPES__.js');
}
