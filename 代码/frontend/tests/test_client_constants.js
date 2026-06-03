/**
 * 游戏主页面前端 — 游戏常量单元测试
 * 对应测试用例：UT-C41 ~ UT-C42
 * 测试文件：client/src/common/constants.js
 */

const constants = require('../client/src/common/constants').default
const {
  witchSaveOptions,
  flatTicketOptions,
  winConditionOptions,
  playerCountOptions,
  defaultPlayerCount,
  defaultSeatCount,
  roleMap,
  modalDescMap,
} = constants

// ─────────────────────────────────────────
// UT-C41  女巫自救选项枚举
// ─────────────────────────────────────────
describe('UT-C41  witchSaveOptions — 包含 3 个选项', () => {
  test('选项数量为 3', () => {
    expect(witchSaveOptions).toHaveLength(3)
  })
  test('选项值依次为 1、2、3', () => {
    expect(witchSaveOptions.map(o => o.value)).toEqual([1, 2, 3])
  })
  test('包含"均能自救""首夜自救""不能自救"', () => {
    const labels = witchSaveOptions.map(o => o.label)
    expect(labels).toContain('均能自救')
    expect(labels).toContain('首夜自救')
    expect(labels).toContain('不能自救')
  })
})

// ─────────────────────────────────────────
// UT-C42  平票处理选项枚举
// ─────────────────────────────────────────
describe('UT-C42  flatTicketOptions — 包含 2 个选项', () => {
  test('选项数量为 2', () => {
    expect(flatTicketOptions).toHaveLength(2)
  })
  test('选项值依次为 1（进夜晚）和 2（PK）', () => {
    expect(flatTicketOptions.map(o => o.value)).toEqual([1, 2])
  })
  test('包含"直接进入夜晚""加赛 pk 一轮"', () => {
    const labels = flatTicketOptions.map(o => o.label)
    expect(labels).toContain('直接进入夜晚')
    expect(labels).toContain('加赛 pk 一轮')
  })
})

// ─────────────────────────────────────────
// 其他常量结构验证
// ─────────────────────────────────────────
describe('winConditionOptions — 包含屠边和屠城', () => {
  test('选项数量为 2', () => {
    expect(winConditionOptions).toHaveLength(2)
  })
  test('包含屠边和屠城', () => {
    const labels = winConditionOptions.map(o => o.label)
    expect(labels).toContain('屠边')
    expect(labels).toContain('屠城')
  })
})

describe('playerCountOptions — 支持 6~12 人共 7 档', () => {
  test('选项数量为 7', () => {
    expect(playerCountOptions).toHaveLength(7)
  })
  test('最小值 6，最大值 12', () => {
    expect(playerCountOptions[0].value).toBe(6)
    expect(playerCountOptions[6].value).toBe(12)
  })
})

describe('默认人数常量', () => {
  test('defaultPlayerCount 为 12', () => {
    expect(defaultPlayerCount).toBe(12)
  })
  test('defaultSeatCount 为 12', () => {
    expect(defaultSeatCount).toBe(12)
  })
})

describe('roleMap — 5 种角色', () => {
  test('包含预言家、女巫、猎人、狼人、村民', () => {
    expect(roleMap.predictor).toBe('预言家')
    expect(roleMap.witch).toBe('女巫')
    expect(roleMap.hunter).toBe('猎人')
    expect(roleMap.wolf).toBe('狼人')
    expect(roleMap.villager).toBe('村民')
  })
})

describe('modalDescMap — 行动确认文本', () => {
  test('check 包含"查验"', () => {
    expect(modalDescMap.check.confirm).toContain('查验')
  })
  test('poison 包含"毒药"', () => {
    expect(modalDescMap.poison.confirm).toContain('毒药')
  })
  test('shoot 包含"开枪"', () => {
    expect(modalDescMap.shoot.confirm).toContain('开枪')
  })
  test('boom 包含"自爆"', () => {
    expect(modalDescMap.boom.confirm).toContain('自爆')
  })
})
