var _ = require('lodash');
var React = require('react'), PropTypes = React.PropTypes;

require('./tree-node-file.scss');

module.exports = TreeNodeFile;

function TreeNodeFile(props) {
    var icon = 'file-o';
    var file = props.file;
    if (file.text) {
        icon = 'file-text-o';
    } else if (/\.(jpe?g|png|gif|svg|bmp|psd)$/i.test(file.path)) {
        icon = 'file-image-o';
    } else if (/\.pdf$/i.test(file.path)) {
        icon = 'file-pdf-o';
    }
    var className = 'tree-node-file';
    if (!_.isEmpty(file.components)) {
        className += ' decorated';
    }
    return (
        <div className={className}>
            <i className={`fa fa-fw fa-${icon}`} />
            {file.path}
            {renderComponentBadges(props)}
        </div>
    );
}

TreeNodeFile.propTypes = {
    file: PropTypes.object.isRequired,
    onSelect: PropTypes.func,
};

function renderComponentBadges(props) {
    if (!props.onSelect) {
        return null;
    }
    var componentIds = props.file.components;
    if (_.isEmpty(componentIds)) {
        return null;
    }
    var badges = _.map(componentIds, (id, index) => {
        var handleClick = (evt) => {
            if (props.onSelect) {
                props.onSelect({
                    type: 'select',
                    target: evt.target,
                    id,
                })
            }
        };
        return (
            <div key={index} className="badge" onClick={handleClick}>
                {index + 1}
            </div>
        );
    });
    return <div className="components">{badges}</div>;
}
