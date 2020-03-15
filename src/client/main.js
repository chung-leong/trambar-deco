import { createElement } from 'react';
import { render } from 'react-dom';
import { Application } from './application.jsx';

window.addEventListener('load', initialize);

function initialize(evt) {
  const appContainer = document.getElementById('react-container');
  const appElement = createElement(Application);
  render(appElement, appContainer);
}
