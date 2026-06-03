const path = require('path')
const root = __dirname

module.exports = {
  rootDir: root,
  testMatch: [`${root}/tests/test_*.js`],
  testPathIgnorePatterns: [`${root}/tests/__mocks__/`],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
      plugins: [
        ['@babel/plugin-proposal-decorators', { legacy: true }],
        ['@babel/plugin-proposal-class-properties', { loose: true }],
      ],
    }],
  },
  transformIgnorePatterns: [
    `${root}/node_modules/(?!(mobx|mobx-react)/)`,
  ],
  moduleNameMapper: {
    '^@config$': `${root}/client/src/config/index.js`,
    '^@common/(.*)$': `${root}/client/src/common/$1`,
    '^@helper$': `${root}/client/src/helper/index.js`,
    '^@store/(.*)$': `${root}/client/src/store/$1`,
    '^@assets/(.*)$': `${root}/tests/__mocks__/fileMock.js`,
    '\\.(png|jpg|jpeg|gif|svg|ico)$': `${root}/tests/__mocks__/fileMock.js`,
    '\\.styl$': `${root}/tests/__mocks__/styleMock.js`,
    '^vue$': `${root}/tests/__mocks__/vue.js`,
    '\\.txt\\?raw$': `${root}/tests/__mocks__/textMock.js`,
  },
}
