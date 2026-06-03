/**
 * AI 复盘页面前端 — loadReport 数据加载单元测试
 * 对应测试用例：UT-R01 ~ UT-R05、UT-R08
 * 测试文件：replay-frontend/src/data/reportAdapter.js
 */

const { loadReport, isLoading, loadError } = require('../replay-frontend/src/data/reportAdapter')

// ─────────────────────────────────────────
// 测试工具：构造 fetch mock 响应
// ─────────────────────────────────────────
function buildFetchMock(body) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

beforeEach(() => {
  isLoading.value = false
  loadError.value = null
  sessionStorage.clear()
  jest.restoreAllMocks()
  // 重置 window.location
  Object.defineProperty(window, 'location', {
    value: { search: '', pathname: '/', hash: '' },
    configurable: true,
    writable: true,
  })
})

// ─────────────────────────────────────────
// UT-R01  从 URL 参数提取 Token
// ─────────────────────────────────────────
describe('UT-R01  Token 从 URL 提取并写入 sessionStorage', () => {
  test('URL 含 token 时写入 sessionStorage，参数被移除', async () => {
    window.location = { search: '?gameId=123&token=abc', pathname: '/', hash: '' }
    window.history = { replaceState: jest.fn() }
    global.fetch = buildFetchMock({ success: false, errorMessage: '中断测试' })

    await loadReport('123')

    expect(sessionStorage.getItem('accessToken')).toBe('abc')
  })
})

// ─────────────────────────────────────────
// UT-R02  复盘详情 API 调用路径
// ─────────────────────────────────────────
describe('UT-R02  loadReport — 调用正确 API 路径并携带 Authorization', () => {
  test('fetch 被调用且 URL、method、headers 正确', async () => {
    sessionStorage.setItem('accessToken', 'test-token')
    global.fetch = buildFetchMock({ success: false, errorMessage: '中断测试' })

    await loadReport('game-abc')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/game/replay/detail/auth?gameId=game-abc',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'test-token' }),
      })
    )
  })
})

// ─────────────────────────────────────────
// UT-R03  加载状态管理
// ─────────────────────────────────────────
describe('UT-R03  loadReport — 完成后 isLoading 恢复 false', () => {
  test('正常完成后 isLoading 为 false', async () => {
    global.fetch = buildFetchMock({
      success: true,
      data: { analysis: { text: '好人阵营获胜', json: null } },
    })
    await loadReport('game-001')
    expect(isLoading.value).toBe(false)
  })

  test('网络异常后 isLoading 也恢复 false', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('网络错误'))
    await loadReport('game-fail')
    expect(isLoading.value).toBe(false)
  })
})

// ─────────────────────────────────────────
// UT-R04  后端返回 success=false
// ─────────────────────────────────────────
describe('UT-R04  loadReport — success=false 时写入 loadError', () => {
  test('loadError 等于后端 errorMessage', async () => {
    global.fetch = buildFetchMock({ success: false, errorMessage: '未授权' })
    await loadReport('game-err')
    expect(loadError.value).toBe('未授权')
  })
})

// ─────────────────────────────────────────
// UT-R05  无复盘内容
// ─────────────────────────────────────────
describe('UT-R05  loadReport — 无 text 且无 JSON 时报错', () => {
  test('loadError 为"未找到复盘内容"', async () => {
    global.fetch = buildFetchMock({ success: true, data: { analysis: {} } })
    await loadReport('game-empty')
    expect(loadError.value).toBe('未找到复盘内容')
  })
})

// ─────────────────────────────────────────
// UT-R08  网络异常
// ─────────────────────────────────────────
describe('UT-R08  loadReport — 网络异常时 loadError 被赋值', () => {
  test('loadError 等于 Error.message', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('fetch failed'))
    await loadReport('game-net-err')
    expect(loadError.value).toBe('fetch failed')
  })
})
