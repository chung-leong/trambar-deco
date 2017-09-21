var _ = require('lodash');
var React = require('react'), PropTypes = React.PropTypes;

var TreeNodeFile = require('widgets/tree-node-file');

require('./tree-node-folder.scss');

var TreeNodeFolder = module.exports = React.createClass({
    displayName: 'TreeNodeFolder',
    propTypes: {
        folder: PropTypes.object.isRequired,
        onSelect: PropTypes.func,
    },

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render: function() {
        var folder = this.props.folder;
        return (
            <div className="tree-node-folder">
                <i className="fa fa-folder fa-fw" />
                {folder.path || '[ROOT]'}
                <div className="files">
                    {_.map(folder.children, this.renderChild)}
                </div>
            </div>
        );
    },

    /**
     * Render child node
     *
     * @param  {Object} child
     * @param  {Number} index
     *
     * @return {ReactElement}
     */
    renderChild: function(child, index) {
        if (child.children) {
            var props = {
                key: index,
                folder: child,
                onSelect: this.props.onSelect,
            };
            return <TreeNodeFolder {...props} />;
        } else {
            var props = {
                key: index,
                file: child,
                onSelect: this.props.onSelect,
            };
            return <TreeNodeFile {...props} />;
        }
    },
});
