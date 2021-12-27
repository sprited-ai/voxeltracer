'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

const path = require('path');
// const fs = require('fs');

/**
 * Webpack config
 *  
 * References:
 * - https://webpack.js.org/guides/author-libraries/
 * - https://joshuatz.com/posts/2020/vscode-intellisense-autocomplete-for-webpack-config-files/
 * - https://webpack.js.org/guides/typescript/#basic-setup
 * - https://marcobotto.com/blog/compiling-and-bundling-typescript-libraries-with-webpack/
 * - Webpack config is a from Create React App.
 * 
 * TODO: Dev version with source map.
 * 
 * @type {import('webpack').Configuration}
 */
module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'voxelviewer.js',
    library: "voxelviewer"
  },
  module: {
    strictExportPresence: true,
    rules: [
      // Disable require.ensure as it's not a standard language feature.
      { parser: { requireEnsure: false } },

      // First, run the linter.
      // It's important to do this before Babel processes the JS.
      {
        test: /\.(js|mjs|jsx)$/,
        enforce: 'pre',
        use: [
          {
            options: {
              formatter: require.resolve('react-dev-utils/eslintFormatter'),
              eslintPath: require.resolve('eslint'),
              
            },
            loader: require.resolve('eslint-loader'),
          },
        ],
        include: path.resolve("src"),
      },
      {
        oneOf: [
          // Process application JS with Babel.
          // The preset includes JSX, Flow, TypeScript and some ESnext features.
          {
            test: /\.(js|mjs|jsx|ts|tsx)$/,
            include: path.resolve("src"),

            loader: require.resolve('babel-loader'),
            options: {
              customize: require.resolve(
                'babel-preset-react-app/webpack-overrides'
              ),
              
              plugins: [
                [
                  require.resolve('babel-plugin-named-asset-import'),
                  {
                    loaderMap: {
                      svg: {
                        ReactComponent: '@svgr/webpack?-prettier,-svgo![path]',
                      },
                    },
                  },
                ],
              ],
              cacheDirectory: true,
              // Save disk space when time isn't as important
              cacheCompression: true,
              compact: true,
            },
          },
          // Process any JS outside of the app with Babel.
          // Unlike the application JS, we only compile the standard ES features.
          {
            test: /\.(js|mjs)$/,
            exclude: /@babel(?:\/|\\{1,2})runtime/,
            loader: require.resolve('babel-loader'),
            options: {
              babelrc: false,
              configFile: false,
              compact: false,
              presets: [
                [
                  require.resolve('babel-preset-react-app/dependencies'),
                  { helpers: true },
                ],
              ],
              cacheDirectory: true,
              // Save disk space when time isn't as important
              cacheCompression: true,
              
              // If an error happens in a package, it's possible to be
              // because it was compiled. Thus, we don't want the browser
              // debugger to show the original code. Instead, the code
              // being evaluated would be much more helpful.
              sourceMaps: false,
            },
          },
          {
            test: /\.(glsl|vs|fs)$/,
            use: [
              'raw-loader',
              'glslify-loader'
            ]
          },
          // Disabled. Not currently needed.
          // // "file" loader makes sure assets end up in the `build` folder.
          // // When you `import` an asset, you get its filename.
          // // This loader doesn't use a "test" so it will catch all modules
          // // that fall through the other loaders.
          // {
          //   loader: require.resolve('file-loader'),
          //   // Exclude `js` files to keep "css" loader working as it injects
          //   // it's runtime that would otherwise be processed through "file" loader.
          //   // Also exclude `html` and `json` extensions so they get processed
          //   // by webpacks internal loaders.
          //   exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
          //   options: {
          //     name: 'static/media/[name].[hash:8].[ext]',
          //   },
          // },
          // ** STOP ** Are you adding a new loader?
          // Make sure to add the new loader(s) before the "file" loader.
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
  },
};