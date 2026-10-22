const { override, addWebpackPlugin, overrideDevServer } = require('customize-cra');
const CopyPlugin = require('copy-webpack-plugin');
const { getSdkVersion, sdkLibSource, getPublicLibDir } = require('./scripts/zoom-sdk-lib');

// App.tsx loads the SDK media files from /lib/<this version>/. Set here, before
// CRA builds its client environment, so the app and the copied folder always
// agree on the version.
process.env.REACT_APP_ZOOM_SDK_VERSION = getSdkVersion();

const addDevServerCOOPReponseHeader = (config) => {
  config.headers = {
    ...config.headers,
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin'
  };
  config.devMiddleware = {
    ...config.devMiddleware,
    writeToDisk: true,
  }
  return config;
};

module.exports = {
  webpack: override(
    addWebpackPlugin(
      new CopyPlugin({
        patterns: [
          {
            from: sdkLibSource,
            to: getPublicLibDir(),
            // "2.5.0" looks like a file extension, so say explicitly it's a folder.
            toType: 'dir'
          }
        ]
      })
    )
  ),
  devServer: overrideDevServer(addDevServerCOOPReponseHeader)
};
