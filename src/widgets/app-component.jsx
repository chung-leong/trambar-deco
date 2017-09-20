var _ = require('lodash');
var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;
var MarkGor = require('mark-gor/react');

require('./app-component.scss');

module.exports = React.createClass({
    displayName: 'AppComponent',
    propTypes: {
        component: PropTypes.object.isRequired,
        onSelect: PropTypes.func,
    },

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render: function() {
        return (
            <div className="app-component">
                {this.renderDescription()}
                {this.renderAssociatedFiles()}
            </div>
        );
    },

    /**
     * Render component discription
     *
     * @return {ReactElement}
     */
    renderDescription: function() {
        return (
            <div className="description">
                {this.renderPicture()}
                {this.renderText()}
            </div>
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
            var url = `images/${component.image}`;
            return (
                <div className="picture">
                    <img src={url} />
                </div>
            );
        } else {
            var icon = component.icon || {};
            var iconClassName = icon['class'] || 'fa-cubes';
            var iconProps = {
                className: `fa fa-fw ${iconClassName}`,
                style: {
                    color: icon.color,
                    backgroundColor: icon.backgroundColor,
                },
            };
            return (
                <div className="picture">
                    <div className="icon">
                        <i {...iconProps} />
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
        return <div className="text">{elements}</div>;
    },

    /**
     * Render list of files associated with component
     *
     * @return {ReactElement}
     */
    renderAssociatedFiles: function() {
        var files = this.props.component.files;
        return (
            <div className="file-list">
                {_.map(files, this.renderAssociatedFile)}
            </div>
        );
    },

    /**
     * Render one file on the list
     *
     * @param  {String} file
     * @param  {Number} index
     *
     * @return {ReactElement}
     */
    renderAssociatedFile: function(file, index) {
        var icon = '';
        return (
            <div className="file" key={index}>
                {icon}
                {' '}
                {file}
            </div>
        );
    },
});
