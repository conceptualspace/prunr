const path = require('path');

module.exports = (env = {}) => ({
  mode: env.dev ? 'development' : 'production',
  entry: './src/preload.js',
  target: 'electron-preload',
  output: {
    path: path.resolve(__dirname, 'dist/preload'),
    filename: 'preload.js',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  module: {
    rules: require('./webpack.rules'),
  },
});
