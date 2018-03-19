var _ = require('lodash');
var Path = require('path');
var Webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var DefinePlugin = Webpack.DefinePlugin;
var UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
    context: Path.resolve('./src'),
    entry: './main',
    output: {
        path: Path.resolve('./bin/www'),
        filename: 'app.js',
    },
    resolve: {
        extensions: [ '.js', '.jsx' ],
        modules: [ Path.resolve('./src'), Path.resolve('./node_modules') ]
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                query: {
                    presets: [
                        'babel-preset-es2015',
                        'babel-preset-react',
                    ],
                }
            },
            {
                test: /\.css$/,
                loader: 'css-loader'
            },
            {
                test: /\.scss$/,
                use: [
                    {
                        loader: 'style-loader'
                    },
                    {
                        loader: 'css-loader'
                    },
                    {
                        loader: 'sass-loader',
                    }
                ]
            },
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'url-loader',
                query: {
                    limit: 100000,
                    mimetype: 'application/font-woff',
                }
            },
            {
                test: /fonts.*\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'file-loader',
            },
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: Path.resolve(`./src/index.html`),
            filename: Path.resolve(`./bin/www/index.html`),
        }),
    ],
};

var event = process.env.npm_lifecycle_event;

var constants = {};
if (event === 'build') {
    console.log('Optimizing JS code');

    // set NODE_ENV to production
    var plugins = module.exports.plugins;
    var constants = {
        'process.env.NODE_ENV': '"production"'
    };
    plugins.unshift(new DefinePlugin(constants));

    // use Uglify to remove dead-code
    plugins.unshift(new UglifyJSPlugin({
        uglifyOptions: {
            compress: {
              drop_console: true,
            }
        }
    }));
}
