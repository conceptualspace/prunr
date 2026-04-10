const path = require('path');
const webpack = require('webpack');

module.exports = (env = {}) => ({
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  mode: env.dev ? 'development' : 'production',
  entry: './src/main.js',
  target: 'electron-main',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'main.js',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
    'electron-store': 'commonjs electron-store',
  },
  module: {
    rules: require('./webpack.rules'),
  },
  plugins: [
    new webpack.DefinePlugin({
      DEV_SERVER_URL: env.dev ? JSON.stringify('http://localhost:3000') : JSON.stringify(''),
    }),
  ],
});
