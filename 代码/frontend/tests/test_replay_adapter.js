/**
 * AI 复盘页面前端 — reportAdapter 纯函数单元测试
 * 对应测试用例：UT-R06 ~ UT-R19、UT-R27 ~ UT-R54、UT-R55 ~ UT-R66
 * 测试文件：replay-frontend/src/data/reportAdapter.js
 */

const {
  parseJson,
  extractFencedJson,
  extractSections,
  nonEmptyLines,
  listLines,
  splitParagraphs,
  parseVoteChips,
  normalizePlayerId,
  normalizeSkillTitle,
  buildMarkdownVoteRounds,
  buildStructuredVoteRounds,
  buildSpeechIssues,
  buildSkills,
  buildMistakes,
  buildStrategyRecommendations,
  getWinningCamp,
  buildOverview,
  buildReportData,
} = require('../replay-frontend/src/data/reportAdapter')

// ─────────────────────────────────────────
// UT-R08 ~ R10  JSON 代码块提取
// ─────────────────────────────────────────
describe('UT-R08  extractFencedJson — 合法 JSON 代码块', () => {
  test('返回解析后的对象', () => {
    expect(extractFencedJson('```json\n{"key":"val"}\n```')).toEqual({ key: 'val' })
  })
})

describe('UT-R09  extractFencedJson — 非法 JSON', () => {
  test('解析失败返回 null，不抛出异常', () => {
    expect(extractFencedJson('```json\n{broken\n```')).toBeNull()
  })
})

describe('UT-R20  extractFencedJson — 无代码块', () => {
  test('纯文本返回 null', () => {
    expect(extractFencedJson('纯文本内容')).toBeNull()
  })
})

// ─────────────────────────────────────────
// UT-R06 ~ R07  Markdown 小节提取
// ─────────────────────────────────────────
describe('UT-R06  extractSections — 提取"总览"小节', () => {
  test('返回 summary 字段', () => {
    const result = extractSections('## 总览\n本局好人阵营获胜。')
    expect(result.summary).toBe('本局好人阵营获胜。')
  })
})

describe('UT-R07  extractSections — 中文别名映射', () => {
  test('"票型分析"映射为 votes', () => {
    expect(extractSections('## 票型分析\n第1轮').votes).toContain('第1轮')
  })
  test('"技能评估"映射为 skills', () => {
    expect(extractSections('## 技能评估\n预言家准确').skills).toContain('预言家')
  })
  test('"关键失误"映射为 mistakes', () => {
    expect(extractSections('## 关键失误\n过早暴露').mistakes).toContain('过早暴露')
  })
  test('"策略建议"映射为 recommendations', () => {
    expect(extractSections('## 策略建议\n减少主动发言').recommendations).toContain('减少')
  })
})

// ─────────────────────────────────────────
// UT-R21 ~ R26  基础工具函数
// ─────────────────────────────────────────
describe('UT-R21  nonEmptyLines — 过滤空行', () => {
  test('空格行被过滤', () => {
    expect(nonEmptyLines('a\n  \nb\n')).toEqual(['a', 'b'])
  })
})

describe('UT-R22  listLines — 解析 - 格式列表', () => {
  test('去除前缀符号', () => {
    expect(listLines('- 项目1\n- 项目2')).toEqual(['项目1', '项目2'])
  })
})

describe('UT-R23  listLines — 解析 * 格式列表', () => {
  test('* 前缀被去除', () => {
    expect(listLines('* 项目A\n* 项目B')).toEqual(['项目A', '项目B'])
  })
})

describe('UT-R24  splitParagraphs — 双换行切割', () => {
  test('分为两段', () => {
    expect(splitParagraphs('段落一\n\n段落二')).toEqual(['段落一', '段落二'])
  })
})

describe('UT-R25  splitParagraphs — 单换行不切割', () => {
  test('仍为同一段', () => {
    expect(splitParagraphs('第一行\n第二行')).toEqual(['第一行\n第二行'])
  })
})

describe('UT-R26  splitParagraphs — 空字符串', () => {
  test('返回空数组', () => {
    expect(splitParagraphs('')).toEqual([])
  })
})

// ─────────────────────────────────────────
// UT-R29 ~ R31  票数文本提取
// ─────────────────────────────────────────
describe('UT-R29  parseVoteChips — 提取多个票数片段', () => {
  test('返回含两个元素的数组', () => {
    const result = parseVoteChips('Player1获3票，Player2获1票')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('Player1')
  })
})

describe('UT-R30  parseVoteChips — 含"弃票"时返回空数组', () => {
  test('弃票场景返回 []', () => {
    expect(parseVoteChips('本轮弃票，无人被放逐')).toEqual([])
  })
})

describe('UT-R31  parseVoteChips — 含"无人"时返回空数组', () => {
  test('无人投票返回 []', () => {
    expect(parseVoteChips('无人投票')).toEqual([])
  })
})

// ─────────────────────────────────────────
// UT-R32 ~ R34  玩家 ID 规范化
// ─────────────────────────────────────────
describe('UT-R32  normalizePlayerId — p 格式转换', () => {
  test('"p3" 转为 "Player3"', () => {
    expect(normalizePlayerId('p3')).toBe('Player3')
  })
})

describe('UT-R33  normalizePlayerId — 已是 Player 格式', () => {
  test('"Player5" 原样返回', () => {
    expect(normalizePlayerId('Player5')).toBe('Player5')
  })
})

describe('UT-R34  normalizePlayerId — null 值', () => {
  test('null 原样返回', () => {
    expect(normalizePlayerId(null)).toBeNull()
  })
})

// ─────────────────────────────────────────
// UT-R41 ~ R43  技能标题规范化
// ─────────────────────────────────────────
describe('UT-R41  normalizeSkillTitle — 含角色名与玩家', () => {
  test('"Player3，预言家" 格式化为"预言家（Player3）"', () => {
    expect(normalizeSkillTitle('Player3，预言家')).toBe('预言家（Player3）')
  })
})

describe('UT-R42  normalizeSkillTitle — 仅角色名', () => {
  test('"女巫" 原样返回', () => {
    expect(normalizeSkillTitle('女巫')).toBe('女巫')
  })
})

describe('UT-R43  normalizeSkillTitle — 空字符串', () => {
  test('返回"技能表现"', () => {
    expect(normalizeSkillTitle('')).toBe('技能表现')
  })
})

// ─────────────────────────────────────────
// UT-R27 ~ R28  投票轮次构建
// ─────────────────────────────────────────
describe('UT-R28  buildStructuredVoteRounds — 结构化数据', () => {
  test('返回含 1 条的轮次数组，players 含票数', () => {
    const voteAnalysis = {
      round_1: { vote_counts: { p1: 3, p2: 1 }, voted_out: 'Player1' },
    }
    const result = buildStructuredVoteRounds(voteAnalysis)
    expect(result).toHaveLength(1)
    expect(result[0].players).toContain('Player1 3票')
  })
  test('null 输入返回空数组', () => {
    expect(buildStructuredVoteRounds(null)).toEqual([])
  })
})

describe('UT-R27  buildMarkdownVoteRounds — Markdown 列表解析', () => {
  test('解析出 anomaly 字段', () => {
    const section = '- round_1: {"vote_summary":"Player1获3票","anomalies":"无异常"}'
    const result = buildMarkdownVoteRounds(section)
    expect(result).toHaveLength(1)
    expect(result[0].anomaly).toBe('无异常')
  })
})

// ─────────────────────────────────────────
// UT-R35 ~ R40  发言问题解析
// ─────────────────────────────────────────
describe('UT-R35  buildSpeechIssues — 结构化数据优先', () => {
  test('player 和 issue 字段正确', () => {
    const structured = [{ player: 'Player1', issue: '前后矛盾', reason: '...' }]
    const result = buildSpeechIssues('', structured)
    expect(result[0].player).toBe('Player1')
    expect(result[0].issue).toBe('前后矛盾')
  })
})

describe('UT-R37  buildSpeechIssues — 纯文本行提取标签前缀', () => {
  test('提取"多名玩家"前缀', () => {
    const result = buildSpeechIssues('- 多名玩家发言存在逻辑漏洞', [])
    expect(result[0].player).toBe('多名玩家')
  })
})

describe('UT-R38  buildSpeechIssues — 阵营前缀提取', () => {
  test('提取"狼人阵营"前缀', () => {
    const result = buildSpeechIssues('- 狼人阵营发言暴露了身份', [])
    expect(result[0].player).toBe('狼人阵营')
  })
})

// ─────────────────────────────────────────
// UT-R44 ~ R47  技能评估解析
// ─────────────────────────────────────────
describe('UT-R44  buildSkills — 结构化技能评估', () => {
  test('标题含角色和玩家，detail 含评价', () => {
    const structured = [{ role: '女巫', player: 'Player2', evaluation: '用药时机恰当' }]
    const result = buildSkills('', structured)
    expect(result[0].title).toBe('女巫（Player2）')
    expect(result[0].detail).toContain('用药时机恰当')
  })
})

describe('UT-R47  buildSkills — 无结构化数据降级 Markdown', () => {
  test('解析冒号分隔行', () => {
    const result = buildSkills('- 预言家：查验结果准确', [])
    expect(result[0].title).toBe('预言家')
  })
})

// ─────────────────────────────────────────
// UT-R48 ~ R51  关键失误解析
// ─────────────────────────────────────────
describe('UT-R48  buildMistakes — 含 impact 的结构化失误', () => {
  test('title 为玩家名，detail 含失误和影响', () => {
    const structured = [{ player: 'Player4', mistake: '过早暴露', impact: '导致好人失利' }]
    const result = buildMistakes('', structured)
    expect(result[0].title).toBe('Player4')
    expect(result[0].detail).toContain('过早暴露')
  })
})

describe('UT-R50  buildMistakes — 纯字符串条目', () => {
  test('title 为"风险点"', () => {
    const result = buildMistakes('', ['全员跟票'])
    expect(result[0].title).toBe('风险点')
    expect(result[0].detail).toBe('全员跟票')
  })
})

describe('UT-R51  buildMistakes — 无结构化降级 Markdown', () => {
  test('从列表行提取 detail', () => {
    const result = buildMistakes('- 分析逻辑混乱', [])
    expect(result[0].detail).toBe('分析逻辑混乱')
  })
})

// ─────────────────────────────────────────
// UT-R52 ~ R54  策略建议解析
// ─────────────────────────────────────────
describe('UT-R52  buildStrategyRecommendations — 含 target 的结构化建议', () => {
  test('格式为"target：recommendation"', () => {
    const result = buildStrategyRecommendations('', [{ target: '狼人', recommendation: '掩护身份' }])
    expect(result[0]).toBe('狼人：掩护身份')
  })
})

describe('UT-R53  buildStrategyRecommendations — 仅有 advice 字段', () => {
  test('直接返回 advice 内容', () => {
    const result = buildStrategyRecommendations('', [{ advice: '加强逻辑表达' }])
    expect(result[0]).toBe('加强逻辑表达')
  })
})

describe('UT-R54  buildStrategyRecommendations — 降级至 Markdown', () => {
  test('从列表行解析', () => {
    const result = buildStrategyRecommendations('- 注意发言节奏', [])
    expect(result[0]).toBe('注意发言节奏')
  })
})

// ─────────────────────────────────────────
// UT-R55 ~ R57  胜利阵营提取
// ─────────────────────────────────────────
const baseMeta = { winningCamp: '未知' }

describe('UT-R55  getWinningCamp — 好人阵营获胜', () => {
  test('返回"好人阵营获胜"', () => {
    expect(getWinningCamp('好人阵营最终获胜，狼人全灭', baseMeta)).toBe('好人阵营获胜')
  })
})

describe('UT-R56  getWinningCamp — 狼人阵营获胜', () => {
  test('返回"狼人阵营获胜"', () => {
    expect(getWinningCamp('狼人阵营获胜，本局结束', baseMeta)).toBe('狼人阵营获胜')
  })
})

describe('UT-R57  getWinningCamp — 无关键词', () => {
  test('返回 baseMeta.winningCamp 原值', () => {
    expect(getWinningCamp('本局精彩纷呈', baseMeta)).toBe('未知')
  })
})

// ─────────────────────────────────────────
// UT-R60 ~ R62  总览面板构建
// ─────────────────────────────────────────
describe('UT-R60  buildOverview — 4 个指标', () => {
  const meta = { winningCamp: '好人阵营获胜' }
  const voteRounds = [{ round: '第 1 轮' }, { round: '第 2 轮' }]
  const issues = [1, 2, 3].map(i => ({ player: `p${i}`, issue: 'x' }))
  const skills = [{ title: '猎人（P1）', detail: '' }, { title: '女巫（P2）', detail: '合理' }]
  const mistakes = []

  test('返回 4 项指标', () => {
    expect(buildOverview(meta, voteRounds, issues, skills, mistakes)).toHaveLength(4)
  })
  test('票型分析显示 2 轮', () => {
    const result = buildOverview(meta, voteRounds, issues, skills, mistakes)
    expect(result[1].value).toBe('2 轮')
  })
  test('发言问题显示 3 项', () => {
    const result = buildOverview(meta, voteRounds, issues, skills, mistakes)
    expect(result[2].value).toBe('3 项')
  })
})

describe('UT-R61  buildOverview — 有女巫时关键技能优先选女巫', () => {
  const meta = { winningCamp: '好人阵营获胜' }
  const skills = [{ title: '猎人（P1）', detail: '' }, { title: '女巫（P2）', detail: '合理' }]
  test('value 包含"女巫"', () => {
    const result = buildOverview(meta, [], [], skills, [])
    expect(result[3].value).toContain('女巫')
  })
})

describe('UT-R62  buildOverview — 无女巫时选第一个技能', () => {
  const meta = { winningCamp: '好人阵营获胜' }
  const skills = [{ title: '预言家（P1）', detail: '准确' }]
  test('value 包含"预言家"', () => {
    const result = buildOverview(meta, [], [], skills, [])
    expect(result[3].value).toContain('预言家')
  })
})

// ─────────────────────────────────────────
// UT-R64 ~ R66  完整报告构建
// ─────────────────────────────────────────
const baseReport = {
  meta: {
    title: '测试报告',
    winningCamp: '好人阵营获胜',
    narrator: '默认叙述',
    mode: '12 人局',
    gameId: 'test-game',
  },
}

describe('UT-R66  buildReportData — 返回字段完整性', () => {
  test('包含所有必需字段', () => {
    const result = buildReportData(baseReport, '好人阵营获胜', 'g-001')
    ;['meta', 'summaryParagraphs', 'overview', 'voteRounds',
      'speechIssues', 'skillEvaluations', 'mistakes',
      'strategyRecommendations', 'heroTags'].forEach(field => {
      expect(result).toHaveProperty(field)
    })
  })
})

describe('UT-R58  buildReportData — 从摘要提取人数模式', () => {
  test('meta.mode 变为"10 人局"', () => {
    const result = buildReportData(baseReport, '本局为10人游戏，好人阵营获胜。', 'g-002')
    expect(result.meta.mode).toBe('10 人局')
  })
})

describe('UT-R59  buildReportData — gameId 注入 meta', () => {
  test('meta.gameId 等于传入值', () => {
    const result = buildReportData(baseReport, '测试', 'game-999')
    expect(result.meta.gameId).toBe('game-999')
  })
})

describe('UT-R63  buildReportData — heroTags 统计标签', () => {
  test('heroTags[0] 含"轮票型分析"，heroTags[1] 含"项发言问题"', () => {
    const result = buildReportData(baseReport, '好人获胜', 'g1')
    expect(result.heroTags[0]).toContain('轮票型分析')
    expect(result.heroTags[1]).toContain('项发言问题')
  })
})

describe('UT-R64  buildReportData — 有结构化 JSON 时优先使用', () => {
  test('summaryParagraphs 来自结构化摘要', () => {
    const structured = { summary_report: '结构化摘要：好人阵营获胜' }
    const result = buildReportData(baseReport, '', 'g1', structured)
    expect(result.summaryParagraphs[0]).toContain('结构化摘要')
  })
})

describe('UT-R65  buildReportData — 无结构化时降级 Markdown', () => {
  test('summaryParagraphs 来自 Markdown 总览', () => {
    const result = buildReportData(baseReport, '## 总览\nMarkdown 摘要内容', 'g1', null)
    expect(result.summaryParagraphs[0]).toContain('Markdown 摘要内容')
  })
})
