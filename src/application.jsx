var _ = require('lodash');
var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;
var SockJS = require('sockjs-client');

// widgets
var AppComponent = require('widgets/app-component');
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
            view: 'components',
            data: {},
            selectedIcon: '',
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
            onClick: this.handleComponentsButtonClick,
        };
        var sourceTreeProps = {
            icon: 'files-o',
            selected: (this.state.view === 'source-tree'),
            title: 'Source tree',
            onClick: this.handleSourceTreeButtonClick,
        };
        var iconsProps = {
            icon: 'flag',
            selected: (this.state.view === 'icons'),
            title: 'Font Awesome icons',
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
        var components = this.state.data.components;
        return (
            <div className="contents">
                {_.map(components, this.renderComponent)}
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
            component,
        };
        return <AppComponent {...props} />;
    },

    /**
     * Render source tree
     *
     * @return {ReactElement}
     */
    renderSourceTree: function() {
        return (
            <div className="contents">
                <h1>Source Tree</h1>
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
            <div className="contents">
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
     * Called when user clicks components button
     *
     * @param  {Event} evt
     */
    handleComponentsButtonClick: function(evt) {
        this.setState({ view: 'components' });
    },

    /**
     * Called when user clicks source tree button
     *
     * @param  {Event} evt
     */
    handleSourceTreeButtonClick: function(evt) {
        this.setState({ view: 'source-tree' });
    },

    /**
     * Called when user clicks icons button
     *
     * @param  {Event} evt
     */
    handleIconsButtonClick: function(evt) {
        this.setState({ view: 'icons' });
    },

    /**
     * Called when user selects an icon
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
    };
    return (
        <div {...buttonProps}>
            <i className={`fa fa-${props.icon} fa-fw`} />
        </div>
    );
}
