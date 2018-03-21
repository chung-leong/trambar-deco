var React = require('react'), PropTypes = React.PropTypes;
var MarkGor = require('mark-gor/react');

// widgets
var Overlay = require('widgets/overlay');
var PushButton = require('widgets/push-button');

require('./app-component-dialog-box.scss');

module.exports = React.createClass({
    displayName: 'AppComponentDialogBox',
    propTypes: {
        show: PropTypes.bool,
        component: PropTypes.object,
        onClose: PropTypes.func,
    },

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render: function() {
        if (!this.props.component) {
            return null;
        }
        var overlayProps = {
            show: this.props.show,
            onBackgroundClick: this.props.onClose,
        };
        return (
            <Overlay {...overlayProps}>
                <div className="app-component-dialog-box">
                    <div className="contents">
                        {this.renderPicture()}
                        {this.renderText()}
                    </div>
                    {this.renderButtons()}
                </div>
            </Overlay>
        );
    },

    /**
     * Render icon or image
     *
     * @return {ReactElement}
     */
    renderPicture: function() {
        var component = this.props.component;
        if (component.image) {
            var url = component.image.url;
            return (
                <div className="picture">
                    <img src={url} />
                </div>
            );
        } else {
            var icon = component.icon || {};
            var iconClassName = icon.class || 'fa-cubes';
            var style = {
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
    },

    /**
     * Render text description of component, formatted as Markdown
     *
     * @return {ReactElement}
     */
    renderText: function() {
        var text = this.props.component.text.en;
        var elements = MarkGor.parse(text);
        return (
            <div className="text">
                {elements}
            </div>
        );
    },

    /**
     * Render buttons
     *
     * @return {ReactElement}
     */
    renderButtons: function() {
        var closeButtonProps = {
            label: 'OK',
            onClick: this.props.onClose,
        };
        return (
            <div className="buttons">
                <PushButton {...closeButtonProps} />
            </div>
        );
    },
});
