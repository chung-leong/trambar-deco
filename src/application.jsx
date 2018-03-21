var _ = require('lodash');
var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;
var SockJS = require('sockjs-client');
var Masonry = require('react-masonry-component');

// widgets
var AppComponent = require('widgets/app-component');
var AppComponentDialogBox = require('widgets/app-component-dialog-box');
var TreeNodeFolder = require('widgets/tree-node-folder');
var FontAwesomeIcon = require('widgets/font-awesome-icon');
var FontAwesomeDialogBox = require('widgets/font-awesome-dialog-box');

require('font-awesome-webpack');
require('application.scss');

module.exports = React.createClass({
    displayName: 'Application',

    /**
     * Return initial state
     *
     * @return {Object}
     */
    getInitialState: function() {
        return {
            view: this.getViewFromHash(),
            data: null,
            selectedIcon: '',
            selectedComponentId: '',
            showingDialog: false,
        };
    },

    /**
     * Establish Websocket connection
     */
    requestNotification: function() {
        this.socket = new SockJS('/socket');
        this.socket.onopen = (evt) => {
        };
        this.socket.onmessage = (evt) => {
            if (evt.data === 'change') {
                this.retrieveData();
            }
        };
        this.socket.onclose = () => {
            this.socket = null;
            setTimeout(() => {
                this.requestNotification();
            }, 5000);
        };
    },

    /**
     * Retrieve data from Node.js script
     */
    retrieveData: function() {
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'json';
        xhr.open('GET', '/data');
        xhr.send();
        xhr.onload = (evt) => {
            var data = evt.target.response;
            if (!_.isEqual(data, this.state.data)) {
                this.setState({ data });
            }
        };
    },

    /**
     * Connect to Node.js script on mount
     */
    componentWillMount: function() {
        this.retrieveData();
        this.requestNotification();
    },

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render: function() {
        if (!this.state.data) {
            return null;
        }
        return (
            <div className="application">
                {this.renderSideNavigation()}
                {this.renderContents()}
            </div>
        );
    },

    /**
     * Render side navigation
     *
     * @return {ReactElement}
     */
    renderSideNavigation: function() {
        var componentsProps = {
            icon: 'cubes',
            selected: (this.state.view === 'components'),
            title: 'Components',
            url: '#components',
            onClick: this.handleComponentsButtonClick,
        };
        var sourceTreeProps = {
            icon: 'files-o',
            selected: (this.state.view === 'source-tree'),
            title: 'Source tree',
            url: '#source-tree',
            onClick: this.handleSourceTreeButtonClick,
        };
        var iconsProps = {
            icon: 'flag',
            selected: (this.state.view === 'icons'),
            title: 'Font Awesome icons',
            url: '#icons',
            onClick: this.handleIconsButtonClick,
        };
        return (
            <div className="side-navigation">
                <SideButton {...componentsProps} />
                <SideButton {...sourceTreeProps} />
                <SideButton {...iconsProps} />
            </div>
        );
    },

    /**
     * Render currently selected view
     *
     * @return {ReactElement}
     */
    renderContents: function() {
        switch (this.state.view) {
            case 'components': return this.renderComponents();
            case 'source-tree': return this.renderSourceTree();
            case 'icons': return this.renderIcons();
        }
    },

    /**
     * Render list of components
     *
     * @return {ReactElement}
     */
    renderComponents: function() {
        var components = _.sortBy(this.state.data.components, (component) => {
            return _.toLower(component.text.en);
        });
        var selectedComponent = _.find(components, { id: this.state.selectedComponentId });
        var dialogProps = {
            show: this.state.showingDialog,
            component: selectedComponent,
            onClose: this.handleDialogClose,
        };
        return (
            <div className="page-view-port">
                <div className="components">
                    {_.map(components, this.renderComponent)}
                </div>
                <AppComponentDialogBox {...dialogProps} />
            </div>
        );
    },

    /**
     * Render individual component
     *
     * @param  {Object} component
     * @param  {Number} index
     *
     * @return {ReactElement}
     */
    renderComponent: function(component, index) {
        var props = {
            key: index,
            component,
            onSelect: this.handleComponentSelect,
        };
        return <AppComponent {...props} />;
    },

    /**
     * Render source tree
     *
     * @return {ReactElement}
     */
    renderSourceTree: function() {
        var components = this.state.data.components;
        var folder = this.state.data.folder;
        var selectedComponent = _.find(components, { id: this.state.selectedComponentId });
        var dialogProps = {
            show: this.state.showingDialog,
            component: selectedComponent,
            onClose: this.handleDialogClose,
        };
        var treeNodeProps = {
            folder: this.state.data.folder,
            root: this.state.data.root,
            onSelect: this.handleComponentSelect,
        };
        return (
            <div className="page-view-port">
                <TreeNodeFolder {...treeNodeProps} />;
                <AppComponentDialogBox {...dialogProps} />
            </div>
        );
    },

    /**
     * Render list of Font Awesome icons
     *
     * @return {ReactElement}
     */
    renderIcons: function() {
        var classNames = FontAwesomeIcon.getClassNames();
        var dialogProps = {
            show: this.state.showingDialog,
            iconClassName: this.state.selectedIcon,
            onClose: this.handleDialogClose,
        };
        return (
            <div className="page-view-port">
                {_.map(classNames, this.renderIcon)}
                <FontAwesomeDialogBox {...dialogProps} />
            </div>
        );
    },

    /**
     * Render Font Awesome icon
     *
     * @param  {String} className
     * @param  {Number} index
     *
     * @return {[type]}
     */
    renderIcon: function(className, index) {
        var iconProps = {
            key: index,
            className,
            selected: (className === this.state.selectedIcon),
            onSelect: this.handleIconSelect,
        };
        return <FontAwesomeIcon {...iconProps} />
    },

    /**
     * Add event handler on mount
     */
    componentDidMount: function() {
        window.addEventListener('popstate', this.handlePopState);
    },

    /**
     * Get current view from URL hash
     *
     * @return {String}
     */
    getViewFromHash: function() {
        switch (location.hash) {
            case '#icons': return 'icons';
            case '#source-tree': return 'source-tree';
            case '#components':
            default: return 'components';
        }
    },

    /**
     * Change the view
     *
     * @param  {String} name
     */
    setView: function(view) {
        this.setState({ view }, () => {
            history.pushState({}, '', '#' + view);
        });
    },

    handlePopState: function() {
        var view = this.getViewFromHash();
        this.setState({ view });
    },

    /**
     * Called when user clicks components button
     *
     * @param  {Event} evt
     */
    handleComponentsButtonClick: function(evt) {
        this.setView('components');
        evt.preventDefault();
    },

    /**
     * Called when user clicks source tree button
     *
     * @param  {Event} evt
     */
    handleSourceTreeButtonClick: function(evt) {
        this.setView('source-tree');
        evt.preventDefault();
    },

    /**
     * Called when user clicks icons button
     *
     * @param  {Event} evt
     */
    handleIconsButtonClick: function(evt) {
        this.setView('icons');
        evt.preventDefault();
    },

    /**
     * Called when user selects a component
     *
     * @param  {Object} evt
     */
    handleComponentSelect: function(evt) {
        this.setState({
            showingDialog: true,
            selectedComponentId: evt.id,
        });
    },

    /**
     * Called when user selects an icon
     *
     * @param  {Object} evt
     */
    handleIconSelect: function(evt) {
        this.setState({
            showingDialog: true,
            selectedIcon: evt.className,
        });
    },

    /**
     * Called when user closes a dialog box
     *
     * @param  {Event} evt
     */
    handleDialogClose: function(evt) {
        this.setState({
            showingDialog: false,
            selectedIcon: '',
        });
    },
});

function SideButton(props) {
    var buttonProps = {
        className: 'button' + (props.selected ? ' selected' : ''),
        title: props.title,
        onClick: props.onClick,
        href: props.url,
    };
    return (
        <a {...buttonProps}>
            <i className={`fa fa-${props.icon} fa-fw`} />
        </a>
    );
}
