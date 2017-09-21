var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;

// widgets
var Overlay = require('widgets/overlay');
var PushButton = require('widgets/push-button');

require('./font-awesome-dialog-box.scss');

module.exports = React.createClass({
    displayName: 'FontAwesomeDialogBox',
    propTypes: {
        show: PropTypes.bool,
        iconClassName: PropTypes.string,
        onClose: PropTypes.func,
    },

    /**
     * Return initial state of component
     *
     * @return {Object}
     */
    getInitialState: function() {
        return {
            color: localStorage.iconColor || '#000000',
            backgroundColor: localStorage.iconBackgroundColor || '#fca326',
        };
    },

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render: function() {
        if (!this.props.iconClassName) {
            return null;
        }
        var overlayProps = {
            show: this.props.show,
            onBackgroundClick: this.props.onClose,
        };
        return (
            <Overlay {...overlayProps}>
                <div className="font-awesome-dialog-box">
                    {this.renderForm()}
                    {this.renderButtons()}
                </div>
            </Overlay>
        );
    },

    /**
     * Render form
     *
     * @return {ReactElement}
     */
    renderForm: function() {
        var color = this.state.color;
        var backgroundColor = this.state.backgroundColor;
        var definition = [
            `class: ${this.props.iconClassName};`,
            `color: ${color};`,
            `background-color: ${backgroundColor};`,
            ``,
        ].join('\n');
        return (
            <div className="form">
                {this.renderIcon()}
                <div className="input">
                    <label>Foreground color</label>
                    <input type="color" value={color} onChange={this.handleColorChange} />
                </div>
                <div className="input">
                    <label>Background color</label>
                    <input type="color" value={backgroundColor} onChange={this.handleBackgroundColorChange} />
                </div>
                <div className="input">
                    <label>Definition</label>
                    <textarea ref="def" value={definition} readOnly={true} />
                </div>
            </div>
        );
    },

    /**
     * Render icon
     *
     * @return {ReactElement}
     */
    renderIcon: function() {
        var className = this.props.iconClassName;
        var style = {
            color: this.state.color,
            backgroundColor: this.state.backgroundColor,
        };
        return (
            <div className="icon" style={style}>
                <i className={`fa ${className} fa-fw`} />
            </div>
        );
    },

    /**
     * Render buttons
     *
     * @return {ReactElement}
     */
    renderButtons: function() {
        var cancelButtonProps = {
            label: 'Cancel',
            onClick: this.props.onClose,
        };
        var copyButtonProps = {
            label: 'Copy',
            emphasized: true,
            onClick: this.handleCopyClick,
        };
        return (
            <div className="buttons">
                <PushButton {...cancelButtonProps} />
                <PushButton {...copyButtonProps} />
            </div>
        );
    },

    /**
     * Called when user changes the color
     *
     * @param  {Event} evt
     */
    handleColorChange: function(evt) {
        var color = evt.target.value;
        this.setState({ color });
        localStorage.iconColor = color;
    },

    /**
     * Called when user changes the background color
     *
     * @param  {Event} evt
     */
    handleBackgroundColorChange: function(evt) {
        var color = evt.target.value;
        this.setState({ backgroundColor: color });
        localStorage.iconBackgroundColor = color;
    },

    handleCopyClick: function(evt) {
        var defNode = this.refs.def;
        if (defNode) {
            defNode.select();
            document.execCommand('copy');
        }
        if (this.props.onClose) {
            this.props.onClose(evt);
        }
    }
});
