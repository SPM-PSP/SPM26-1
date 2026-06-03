const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const postcssNormalize = require('postcss-normalize')
const webpack = require('webpack')
const clientDir = process.env.CLIENT_DIR || 'client'
const clientPath = path.resolve(__dirname, clientDir)
const {proxy, antdThemeConfig, websocket = {}, replayFrontendUrl = ''} = require(path.join(clientPath, 'config/config-default'))
const rewireReactHotLoader = require('react-app-rewire-hot-loader')

const getProxyHost = () => {
  const apiProxy = (proxy || []).find(item => item && item.target)
  if(!apiProxy){
    return ''
  }
  try {
    return new URL(apiProxy.target).hostname
  } catch (e) {
    return ''
  }
}

const wsDevHost = websocket.dev || getProxyHost()
const wsPrdHost = websocket.prd || ''

const {
  override,
  addWebpackAlias,
  disableEsLint,
  addLessLoader,
  addDecoratorsLegacy,
  setWebpackPublicPath,
  overrideDevServer
} = require('customize-cra')

const devServerConfig = () => config => {
  return {
    ...config,
    compress: true,
    disableHostCheck: true,
    proxy,
  }
}

const stylus = () => config => {
  const mode = process.env.NODE_ENV === 'development' ? 'dev' : 'prod'
  const shouldUseSourceMap = false
  const stylusLoader = {
    test: /\.styl$/,
    include: [path.resolve(clientPath, 'src')],
    exclude: /node_modules/,
    sideEffects: true,
    use: [
      mode === 'prod' ? MiniCssExtractPlugin.loader : require.resolve('style-loader'),
      {
        loader: 'css-loader',
        options: {
          importLoaders: 2,
          sourceMap: shouldUseSourceMap,
        },
      },
      {
        loader: 'postcss-loader',
        options: {
          ident: 'postcss',
          sourceMap: shouldUseSourceMap,
          plugin: () => [
            require('postcss-flexbugs-fixes'),
            require('postcss-preset-env')({
              autoprefixer: {
                flexbox: 'no-2009',
              },
              stage: 3,
            }),
            postcssNormalize(),
          ],
        },
      },
      {
        loader: 'resolve-url-loader',
        options: {
          sourceMap: shouldUseSourceMap,
        },
      },
      {
        loader: 'stylus-loader',
        options: {
          sourceMap: true,
        },
      }

    ]
  }

  const oneOf = config.module.rules.find(rule => rule.oneOf).oneOf
  oneOf.unshift(stylusLoader)
  return config
}

const publicPath = process.env.NODE_ENV === 'production' ? '' : ''

module.exports = {
  webpack:override(
    // use mobx 需要下面两个配置
    addDecoratorsLegacy(),
    disableEsLint(),

    // 修改antd主题色
    addLessLoader({
      javascriptEnabled: true,
      modifyVars: antdThemeConfig
    }),
    setWebpackPublicPath(publicPath),
    addWebpackAlias({
      '@pages': path.resolve(clientPath, 'src/pages'),
      '@api': path.resolve(clientPath, 'src/api'),
      '@common': path.resolve(clientPath, 'src/common'),
      '@config': path.resolve(clientPath, 'src/config'),
      '@router': path.resolve(clientPath, 'src/router'),
      '@components': path.resolve(clientPath, 'src/components'),
      '@store': path.resolve(clientPath, 'src/store'),
      '@assets': path.resolve(clientPath, 'src/assets'),
      '@utils': path.resolve(clientPath, 'src/common/utils'),
      '@helper': path.resolve(clientPath, 'src/helper')
    }),
    stylus(),
    (config) => {
      config.plugins.push(new webpack.DefinePlugin({
        'process.env.REACT_APP_WS_DEV_HOST': JSON.stringify(wsDevHost),
        'process.env.REACT_APP_WS_PRD_HOST': JSON.stringify(wsPrdHost),
        'process.env.REACT_APP_REPLAY_URL': JSON.stringify(process.env.REACT_APP_REPLAY_URL || replayFrontendUrl),
      }))
      return config
    },
    (config, env) => {
      config = rewireReactHotLoader(config, env)
      return config
    }
  ),
  devServer: overrideDevServer(devServerConfig()),
  paths: function (paths, env){
    // 因为client才是前端root目录，需要重新设置下打包目录
    paths.appPath = clientPath
    paths.appBuild = path.join(__dirname, '/public')
    paths.appPublic = path.join(clientPath, '/public')
    paths.appHtml = path.join(clientPath, '/public/index.html')
    paths.appIndexJs = path.join(clientPath, '/src/index.js')
    paths.appSrc = path.join(clientPath, '/src')
    return paths
  }
}
