/**
 * 游戏主页面前端 — 工具函数单元测试
 * 对应测试用例：UT-C27 ~ UT-C31（UT-C78 ~ UT-C89）
 * 测试文件：client/src/common/utils.js
 */

jest.mock('../client/src/config/index.js', () => ({
  default: { websocket: { dev: 'ws://localhost', prd: 'ws://prod' } },
}))

const utils = require('../client/src/common/utils').default

// ─────────────────────────────────────────
// UT-C78 ~ UT-C82  日期格式化
// ─────────────────────────────────────────
describe('UT-C78  getCurrentDate — 默认连字符分隔符', () => {
  test('2026-05-31 格式正确', () => {
    expect(utils.getCurrentDate(new Date('2026-05-31'))).toBe('2026-05-31')
  })
})

describe('UT-C79  getCurrentDate — 自定义分隔符', () => {
  test('斜杠分隔返回 2026/05/31', () => {
    expect(utils.getCurrentDate(new Date('2026-05-31'), '/')).toBe('2026/05/31')
  })
})

describe('UT-C80  getDateString — 中文格式', () => {
  test('返回 2026年05月31日', () => {
    expect(utils.getDateString(new Date('2026-05-31'))).toBe('2026年05月31日')
  })
})

describe('UT-C81  getCurrentDateYYDDMMhhmmss — 完整时间戳', () => {
  test('返回 2026-05-31 14:30:05', () => {
    expect(utils.getCurrentDateYYDDMMhhmmss(new Date('2026-05-31T14:30:05'))).toBe('2026-05-31 14:30:05')
  })
})

describe('UT-C82  getDateDir — 无分隔符紧凑时间', () => {
  test('返回 20260531143005', () => {
    expect(utils.getDateDir(new Date('2026-05-31T14:30:05'))).toBe('20260531143005')
  })
})

// ─────────────────────────────────────────
// UT-C83 ~ UT-C85  邮箱格式验证
// ─────────────────────────────────────────
describe('UT-C83  verifyEmailFormat — 合法邮箱', () => {
  test('test@example.com 返回 true', () => {
    expect(utils.verifyEmailFormat('test@example.com')).toBe(true)
  })
})

describe('UT-C84  verifyEmailFormat — 非法邮箱', () => {
  test('"notanemail" 返回 false', () => {
    expect(utils.verifyEmailFormat('notanemail')).toBe(false)
  })
})

describe('UT-C85  verifyEmailFormat — 空字符串', () => {
  test('空字符串返回 false', () => {
    expect(utils.verifyEmailFormat('')).toBe(false)
  })
})

// ─────────────────────────────────────────
// UT-C86 ~ UT-C87  手机号格式验证
// ─────────────────────────────────────────
describe('UT-C86  verifyPhoneFormat — 位数不足', () => {
  test('"12345"（5位）返回 false', () => {
    expect(utils.verifyPhoneFormat('12345')).toBe(false)
  })
})

describe('UT-C87  verifyPhoneFormat — 空字符串', () => {
  test('空字符串返回 false', () => {
    expect(utils.verifyPhoneFormat('')).toBe(false)
  })
})

// ─────────────────────────────────────────
// UT-C88 ~ UT-C89  URL 修正
// ─────────────────────────────────────────
describe('UT-C88  getFixUrl — 开发环境相对路径', () => {
  const origEnv = process.env.NODE_ENV
  afterEach(() => { process.env.NODE_ENV = origEnv })

  test('拼接 localhost:8090 前缀', () => {
    process.env.NODE_ENV = 'development'
    expect(utils.getFixUrl('/api/test')).toBe('http://localhost:8090/api/test')
  })
})

describe('UT-C89  getFixUrl — 已含 http 前缀', () => {
  test('原样返回，不重复拼接', () => {
    expect(utils.getFixUrl('http://example.com/api')).toBe('http://example.com/api')
  })
})
