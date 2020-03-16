import PropTypes from 'prop-types';

import { AppComponentDialogBox } from './app-component-dialog-box.jsx';
import { AppComponent } from './app-component.jsx';
import { FontAwesomeDialogBox } from './font-awesome-dialog-box.jsx';
import { FontAwesomeIcon } from './font-awesome-icon.jsx';
import { PushButton } from './push-button.jsx';
import { TreeNodeFile } from './tree-node-file.jsx';
import { TreeNodeFolder } from './tree-node-folder.jsx';

AppComponentDialogBox.propTypes = {
  show: PropTypes.bool,
  component: PropTypes.object,
  languageCode: PropTypes.string.isRequired,
  onClose: PropTypes.func,
};
AppComponent.propTypes = {
  component: PropTypes.object.isRequired,
  languageCode: PropTypes.string.isRequired,
  onSelect: PropTypes.func,
};
FontAwesomeDialogBox.propTypes = {
  show: PropTypes.bool,
  icon: PropTypes.object,
  onClose: PropTypes.func,
};
FontAwesomeIcon.propTypes = {
  className: PropTypes.string.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
};
PushButton.propTypes = {
  label: PropTypes.node,
  hidden: PropTypes.bool,
  disabled: PropTypes.bool,
  emphasized: PropTypes.bool,
  onClick: PropTypes.func,
};
TreeNodeFile.propTypes = {
  file: PropTypes.object.isRequired,
  onSelect: PropTypes.func,
};
TreeNodeFolder.propTypes = {
  folder: PropTypes.object,
  root: PropTypes.string,
  onSelect: PropTypes.func,
};
