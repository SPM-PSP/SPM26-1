module.exports = {
  // 复盘前端地址，联调时改成运行复盘前端的机器IP
  replayFrontendUrl: 'http://192.168.22.152:5173',

  proxy: [
    {
      // api的接口全部转到6001的服务端去
      context: ['/api'],
      target: 'http://192.168.22.60:6001',
      changeOrigin: true,
    },
  ],
  websocket: {
    // 默认跟随上面的 API proxy target；如果 websocket 和 API 不在同一台机器，再单独填 dev。
    dev: '',
    prd: '120.48.51.123',
  },
  // antd 主题配置
  antdThemeConfig: {
    '@primary-color': '#4169E1', // 全局主色
    '@link-color': '#4169E1', // 链接色
    '@font-size-base': '12px',
  },

  // 外部资源地址
  resources: [
    '//cdn.yyyangyang.com/public/babel-polyfill/6.26.0/polyfill.min.js',
    '//cdn.yyyangyang.com/public/react/16.13.1/react.min.js',
    '//cdn.yyyangyang.com/public/react-dom/16.13.1/react-dom.min.js',
    '//cdn.yyyangyang.com/public/react-router/5.2.0/react-router.min.js',
    '//cdn.yyyangyang.com/public/react-router-dom/5.2.0/react-router-dom.min.js',
    '//cdn.yyyangyang.com/public/mobx/5.15.4/mobx.umd.min.js',
    '//cdn.yyyangyang.com/public/mobx-react-lite/2.0.6/mobxreactlite.umd.production.min.js',
    '//cdn.yyyangyang.com/public/mobx-react/6.2.2/mobxreact.umd.production.min.js',
    '//cdn.yyyangyang.com/public/moment/2.24.0/moment.min.js',
    '//cdn.yyyangyang.com/public/moment/2.24.0/zh-cn.js',
    '//cdn.yyyangyang.com/public/antd/4.16.0/antd.min.js',
    '//cdn.yyyangyang.com/public/lodash/4.17.11/lodash.min.js',
  ],
}
