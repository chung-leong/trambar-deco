var _ = require('lodash');
var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;

require('./font-awesome-icon.scss');

module.exports = React.createClass({
    displayName: 'FontAwesomeIcon',
    propTypes: {
        className: PropTypes.string.isRequired,
        selected: PropTypes.bool,

        onSelect: PropTypes.func,
    },

    statics: {
        getClassNames: function() {
            var classNames = [];
            _.each(document.styleSheets, (styleSheet) => {
                _.each(styleSheet.rules, (rule) => {
                    if (rule.style && rule.style.content) {
                        var selector = rule.selectorText;
                        var matches = selector.match(/\.(fa-\S+)::before/g);
                        _.each(matches, (match) => {
                            var className = match.slice(1, -8);
                            classNames.push(className);
                        });
                    }
                });
            });
            return classNames;
        }
    },

    render: function() {
        var className = 'font-awesome-icon';
        if (this.props.selected) {
            className += ' selected';
        }
        var iconClassName = this.props.className;
        var label = iconClassName.substr(3);
        return (
            <div className={className} onClick={this.handleClick} title={label}>
                <i className={`fa ${iconClassName} fa-fw`}/>
                <div className="label">{label}</div>
            </div>
        );
    },

    handleClick: function() {
        if (this.props.onSelect) {
            this.props.onSelect({
                type: 'select',
                target: this,
                className: this.props.className,
            });
        }
    }
});
