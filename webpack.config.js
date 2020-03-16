const Path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCSSExtractPlugin = require('mini-css-extract-plugin');

const event = process.env.npm_lifecycle_event;
const otherHOCs = [ 'Overlay.create' ];

module.exports = {
  mode: (event === 'build') ? 'production' : 'development',
  context: Path.resolve('./src/client'),
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
            '@babel/env',
            '@babel/react',
          ],
          plugins: [
            '@babel/transform-runtime',
            [ 'relaks/transform-memo', { otherHOCs } ]
          ]
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCSSExtractPlugin.loader,
          'css-loader',
        ],
      },
      {
        test: /\.scss$/,
        use: [
          MiniCSSExtractPlugin.loader,
          'css-loader',
          'sass-loader'
        ],
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
      template: Path.resolve(`./src/client/index.html`),
      filename: Path.resolve(`./bin/www/index.html`),
    }),
    new MiniCSSExtractPlugin({
      filename: "[name].css?[hash]",
      chunkFilename: "[id].css?[hash]"
    }),
  ],
};
