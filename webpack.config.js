const Path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const event = process.env.npm_lifecycle_event;
const otherHOCs = [ 'Overlay.create' ];

module.exports = {
  mode: (event === 'build') ? 'production' : 'development',
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
