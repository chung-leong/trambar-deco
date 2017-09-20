var _ = require('lodash');
var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;

require('./font-awesome-icon.scss');

module.exports = React.createClass({
    displayName: 'FontAwesomeIcon',
    propTypes: {
        className: PropTypes.string.isRequired,
        selected: PropTypes.Boolean,

        onSelect: PropTypes.func,
    },

    statics: {
        getClassNames: function() {
            var classNames = [];
            _.each(document.styleSheets, (styleSheet) => {
                _.each(styleSheet.rules, (rule) => {
                    if (rule.style && rule.style.content) {
                        var selector = rule.selectorText;
                        var m = /^\.(fa-\S+)::before$/.exec(selector);
                        if (m) {
                            classNames.push(m[1]);
                        }
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
        return (
            <div className={className} onClick={this.handleClick}>
                <i className={`fa ${this.props.className} fa-fw`} />
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
