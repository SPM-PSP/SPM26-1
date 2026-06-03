/**
 * 游戏主页面前端 — 认证 helper 单元测试
 * 对应测试用例：UT-C06 ~ UT-C07
 * 测试文件：client/src/helper/index.js
 */

// mock js-cookie
const mockStore = {}
jest.mock('js-cookie', () => ({
  get: jest.fn(key => mockStore[key]),
  set: jest.fn((key, value) => { mockStore[key] = value }),
  remove: jest.fn(key => { delete mockStore[key] }),
}))

// mock @common/mock
jest.mock('../client/src/common/mock', () => ({
  isMockEnabled: jest.fn(() => false),
  isMockToken: jest.fn(() => false),
  mockFetch: jest.fn(),
}))

const Cookies = require('js-cookie')
const helper = require('../client/src/helper/index').default

beforeEach(() => {
  Object.keys(mockStore).forEach(k => delete mockStore[k])
  jest.clearAllMocks()
})

// ─────────────────────────────────────────
// UT-C07  Token 写入 Cookie
// ─────────────────────────────────────────
describe('UT-C07  setToken — 写入 accessToken 到 Cookie', () => {
  test('调用 Cookies.set 且有效期 30 天', () => {
    helper.setToken('abc123')
    expect(Cookies.set).toHaveBeenCalledWith('accessToken', 'abc123', { expires: 30 })
  })
})

// ─────────────────────────────────────────
// getToken
// ─────────────────────────────────────────
describe('getToken — Cookie 有值时返回 token', () => {
  test('返回 Cookie 中存储的 token', () => {
    mockStore['accessToken'] = 'test-token'
    expect(helper.getToken()).toBe('test-token')
  })
  test('Cookie 无值时返回 undefined', () => {
    expect(helper.getToken()).toBeUndefined()
  })
})

// ─────────────────────────────────────────
// removeToken
// ─────────────────────────────────────────
describe('removeToken — 清除 accessToken', () => {
  test('调用 Cookies.remove', () => {
    helper.removeToken()
    expect(Cookies.remove).toHaveBeenCalledWith('accessToken')
  })
})

// ─────────────────────────────────────────
// UT-C06  权限检查
// ─────────────────────────────────────────
describe('UT-C06  hasCPermission — 有权限返回 true', () => {
  const store = {
    currentRole: 'admin',
    cPermission: [
      { key: 'system.admin', permKey: 'system.admin', roles: ['admin', 'superAdmin'] },
    ],
  }
  test('角色在权限列表中返回 true', () => {
    expect(helper.hasCPermission('system.admin', store)).toBe(true)
  })
})

describe('UT-C07  hasCPermission — 无权限返回 false', () => {
  const store = {
    currentRole: 'guest',
    cPermission: [
      { key: 'system.admin', permKey: 'system.admin', roles: ['admin'] },
    ],
  }
  test('角色不在权限列表中返回 false', () => {
    expect(helper.hasCPermission('system.admin', store)).toBe(false)
  })
  test('权限 key 不存在返回 false', () => {
    expect(helper.hasCPermission('nonexistent', store)).toBe(false)
  })
  test('reverse=true 时权限不存在返回 true', () => {
    expect(helper.hasCPermission('nonexistent', store, true)).toBe(true)
  })
})
