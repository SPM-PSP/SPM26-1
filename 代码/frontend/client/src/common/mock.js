const MOCK_TOKEN = 'mock-access-token'
const MOCK_ROOM_ID = 'mock-room-001'
const MOCK_GAME_ID = 'mock-game-001'

const clone = (data) => JSON.parse(JSON.stringify(data))

const mockUser = {
  _id: 'mock-user-001',
  username: 'host',
  name: '格林镇长',
  roles: ['player'],
  defaultRole: 'player',
}

const mockRoleProfiles = {
  hunter: {
    role: 'hunter',
    roleName: '猎人',
    camp: 1,
    campName: '好人阵营',
    recordTip: '请在白天被放逐或夜晚被袭击时准备开枪。',
  },
  wolf: {
    role: 'wolf',
    roleName: '狼人',
    camp: 0,
    campName: '狼人阵营',
    recordTip: '请在夜晚与狼队一起寻找袭击目标。',
  },
  witch: {
    role: 'witch',
    roleName: '女巫',
    camp: 1,
    campName: '好人阵营',
    recordTip: '请谨慎使用解药与毒药，守住村庄的生死边界。',
  },
  predictor: {
    role: 'predictor',
    roleName: '预言家',
    camp: 1,
    campName: '好人阵营',
    recordTip: '请在夜晚查验一名玩家的阵营。',
  },
  villager: {
    role: 'villager',
    roleName: '村民',
    camp: 1,
    campName: '好人阵营',
    recordTip: '请通过发言和投票帮助村庄找出狼人。',
  },
}

const mockRoleCycle = ['hunter', 'wolf', 'witch', 'predictor', 'villager']
let mockRoleCursor = 0

const mockSkillMap = {
  wolf: [
    { name: '袭击', key: 'assault', status: 1 },
    { name: '自爆', key: 'boom', status: 1 },
  ],
  predictor: [
    { name: '查验', key: 'check', status: 1 },
  ],
  witch: [
    { name: '解药', key: 'antidote', status: 1 },
    { name: '毒药', key: 'poison', status: 1 },
  ],
  hunter: [
    { name: '开枪', key: 'shoot', status: 0 },
  ],
  villager: [],
}

const mockPlayers = [
  { username: 'host', name: '格林镇长', position: 1, role: 'hunter', roleName: '猎人', camp: 1, campName: '好人阵营', status: 1 },
  { username: 'ai-02', name: '银灯旅人', position: 2, role: 'wolf', roleName: '狼人', camp: 0, campName: '狼人阵营', status: 1 },
  { username: 'ai-03', name: '乌鸦医生', position: 3, role: 'witch', roleName: '女巫', camp: 1, campName: '好人阵营', status: 1 },
  { username: 'ai-04', name: '钟楼学徒', position: 4, role: 'villager', roleName: '村民', camp: 1, campName: '好人阵营', status: 1 },
  { username: 'ai-05', name: '雾巷裁缝', position: 5, role: 'predictor', roleName: '预言家', camp: 1, campName: '好人阵营', status: 1 },
  { username: 'ai-06', name: '渡口守夜人', position: 6, role: 'wolf', roleName: '狼人', camp: 0, campName: '狼人阵营', status: 1 },
  { username: 'ai-07', name: '栗木面包师', position: 7, role: 'villager', roleName: '村民', camp: 1, campName: '好人阵营', status: 1 },
  { username: 'ai-08', name: '红围巾猎户', position: 8, role: 'wolf', roleName: '狼人', camp: 0, campName: '狼人阵营', status: 1 },
  { username: 'ai-09', name: '旧书店老板', position: 9, role: 'villager', roleName: '村民', camp: 1, campName: '好人阵营', status: 1 },
]

const resetMockPlayers = () => {
  mockPlayers.forEach(item => {
    item.status = 1
    delete item.outReason
  })
}

const getMockSelfPlayer = () => mockPlayers.find(item => item.username === mockUser.username) || mockPlayers[0]

const applyMockSelfRole = (role) => {
  const selfPlayer = getMockSelfPlayer()
  const pickedRole = role || mockRoleCycle[mockRoleCursor % mockRoleCycle.length] || 'hunter'
  if (!role) {
    mockRoleCursor += 1
  }
  const profile = mockRoleProfiles[pickedRole] || mockRoleProfiles.hunter
  if (selfPlayer) {
    Object.assign(selfPlayer, {
      role: profile.role,
      roleName: profile.roleName,
      camp: profile.camp,
      campName: profile.campName,
    })
  }
  return profile
}

const createSeat = () => {
  const seats = []
  for (let i = 1; i <= 12; i += 1) {
    const player = mockPlayers.find(item => item.position === i)
    seats.push({
      position: i,
      name: i + '号',
      player: player ? {
        username: player.username,
        name: player.name,
        role: player.role,
      } : null,
    })
  }
  return seats
}

const createRoom = (status = 0) => ({
  _id: MOCK_ROOM_ID,
  name: '雾中窥影体验房',
  password: 'MOCK',
  owner: mockUser.username,
  status,
  count: 12,
  wait: ['guest-01'],
  gameId: status === 1 ? MOCK_GAME_ID : null,
  seat: createSeat(),
  waitPlayer: [
    { username: 'guest-01', name: '路过的观战者' },
  ],
})

let mockState = {
  user: clone(mockUser),
  room: createRoom(0),
  stage: 0,
  gameStatus: 1,
  isOb: false,
  votes: [],
  exileResult: null,
  actions: [],
  speechRecords: [],
  speechRecordCursor: 1000,
  winner: null,
}

const stageMap = [
  { stage: 0, dayTag: '夜幕降临', stageName: '幕布', broadcast: '请确认身份，村庄的钟声即将响起。' },
  { stage: 1, dayTag: '夜晚', stageName: '预言家行动', broadcast: '预言家睁眼，可以查验一名玩家的阵营。' },
  { stage: 2, dayTag: '夜晚', stageName: '狼人行动', broadcast: '狼人请睁眼，选择今晚袭击的目标。' },
  { stage: 3, dayTag: '夜晚', stageName: '女巫行动', broadcast: '女巫请睁眼，可以选择使用解药或毒药。' },
  { stage: 4, dayTag: '白天', stageName: '天亮公布', broadcast: '天亮了，昨夜信息正在公布。' },
  { stage: 5, dayTag: '白天', stageName: '发言阶段', broadcast: '天亮了，请按顺序发言。' },
  { stage: 6, dayTag: '白天', stageName: '投票放逐', broadcast: '所有玩家开始投票，选择你怀疑的目标。' },
  { stage: 6.5, dayTag: '白天', stageName: 'PK投票', broadcast: '平票玩家进入 PK 投票阶段。' },
  { stage: 7, dayTag: '黄昏', stageName: '放逐结算', broadcast: '放逐结果正在结算，新的夜晚即将到来。' },
]

const getStageInfo = () => stageMap.find(item => item.stage === mockState.stage) || stageMap[0]

const getMockBroadcast = (stageInfo) => {
  if (stageInfo.stage === 7 && mockState.exileResult) {
    if (mockState.exileResult.noOut) {
      return '本轮无人获得放逐票，没有玩家出局。'
    }
    const target = mockState.exileResult.target
    return `${target.position}号玩家（${target.name}）获得最高票数，出局！`
  }
  if (stageInfo.stage === 6 && mockState.votes.length > 0) {
    const target = mockPlayers.find(item => item.username === mockState.votes[0].to)
    if (target) {
      return `你已投票给${target.position}号玩家（${target.name}），等待放逐结算。`
    }
  }
  if (stageInfo.stage === 2) {
    const currentRole = getMockSelfPlayer()
    const assaultAction = mockState.actions.find(item => item.from === currentRole.username && item.stage === 2 && item.action === 'assault')
    const target = assaultAction && mockPlayers.find(item => item.username === assaultAction.to)
    if (target) {
      return `你今晚袭击了${target.position}号玩家（${target.name}），该玩家已出局。`
    }
  }
  if (stageInfo.stage === 1) {
    const currentRole = getMockSelfPlayer()
    const checkAction = mockState.actions.find(item => item.from === currentRole.username && item.stage === 1 && item.action === 'check')
    const target = checkAction && mockPlayers.find(item => item.username === checkAction.to)
    if (target) {
      return `你查验了${target.position}号玩家（${target.name}）：${target.campName}。`
    }
  }
  return stageInfo.broadcast
}

const getVisiblePlayers = () => mockPlayers.map(item => {
  const isSelf = item.username === mockState.user.username
  return {
    ...item,
    isSelf,
    isTarget: !isSelf && item.status === 1,
    camp: isSelf || item.role === 'wolf' ? item.camp : null,
    campName: isSelf || item.role === 'wolf' ? item.campName : null,
    role: isSelf ? item.role : null,
    roleName: isSelf ? item.roleName : null,
  }
})

const getMockGame = () => {
  const currentRole = getMockSelfPlayer()
  const stageInfo = getStageInfo()
  const broadcast = getMockBroadcast(stageInfo)
  const hasVoted = mockState.votes.some(item => item.from === currentRole.username && item.stage === stageInfo.stage)
  const hasAssaulted = mockState.actions.some(item => item.from === currentRole.username && item.stage === 2 && item.action === 'assault')
  const roleSkills = mockSkillMap[currentRole.role] || []
  const skill = roleSkills.map(item => {
    if (item.key === 'assault') {
      const show = stageInfo.stage === 2 && currentRole.status === 1 && item.status === 1
      return {
        key: item.key,
        name: item.name,
        show,
        canUse: show && !hasAssaulted,
      }
    }
    if (item.key === 'boom') {
      const show = stageInfo.stage === 5 && currentRole.status === 1 && item.status === 1
      return {
        key: item.key,
        name: item.name,
        show,
        canUse: show,
      }
    }
    if (item.key === 'check') {
      const hasChecked = mockState.actions.some(action => action.from === currentRole.username && action.stage === 1 && action.action === 'check')
      const show = stageInfo.stage === 1 && currentRole.status === 1 && item.status === 1
      return {
        key: item.key,
        name: item.name,
        show,
        canUse: show && !hasChecked,
      }
    }
    if (item.key === 'antidote' || item.key === 'poison') {
      const hasUsedWitchSkill = mockState.actions.some(action => action.from === currentRole.username && action.stage === 3 && ['antidote', 'poison'].includes(action.action))
      const show = stageInfo.stage === 3 && currentRole.status === 1 && item.status === 1
      return {
        key: item.key,
        name: item.name,
        show,
        canUse: show && !hasUsedWitchSkill,
      }
    }
    if (item.key === 'shoot') {
      const show = [4, 7].includes(stageInfo.stage) && currentRole.status === 1
      return {
        key: item.key,
        name: item.name,
        show,
        canUse: show,
      }
    }
    return {
      key: item.key,
      name: item.name,
      show: false,
      canUse: false,
    }
  })
  return {
    _id: MOCK_GAME_ID,
    roomId: MOCK_ROOM_ID,
    owner: mockState.user.username,
    status: mockState.gameStatus,
    day: mockState.stage === 0 ? 0 : 1,
    stage: stageInfo.stage,
    dayTag: stageInfo.dayTag,
    stageName: stageInfo.stageName,
    isOb: mockState.isOb,
    roleInfo: {
      ...currentRole,
      isSelf: true,
      isTarget: false,
    },
    playerInfo: getVisiblePlayers(),
    skill,
    action: [
      { key: 'vote', name: '投票', show: [6, 6.5].includes(stageInfo.stage), canUse: [6, 6.5].includes(stageInfo.stage) && !hasVoted },
    ],
    broadcast: [
      { text: broadcast, level: stageInfo.stage === 7 && mockState.exileResult && !mockState.exileResult.noOut ? 2 : 4 },
    ],
    systemTip: [
      { text: '当前为前端 mock 模式，所有数据均来自浏览器本地模拟。', level: 6 },
    ],
    speechRecords: clone(mockState.speechRecords),
    speechTurn: {
      currentSpeaker: {
        username: currentRole.username,
        name: currentRole.name,
        position: currentRole.position,
      },
      currentIndex: 0,
      total: mockPlayers.length,
      order: mockPlayers.map(item => ({
        username: item.username,
        name: item.name,
        position: item.position,
      })),
    },
    winner: mockState.winner,
  }
}

const saveMockSpeechRecord = (type, text) => {
  const selfPlayer = getMockSelfPlayer()
  mockState.speechRecordCursor += 1
  const record = {
    _id: mockState.speechRecordCursor,
    day: mockState.stage === 0 ? 0 : 1,
    stage: mockState.stage,
    type,
    text,
    source: type === 'lastWords' ? 'player' : 'human',
    from: {
      username: selfPlayer.username,
      name: selfPlayer.name,
      position: selfPlayer.position,
    },
  }
  mockState.speechRecords.push(record)
  return record
}

const settleMockVote = () => {
  if (mockState.exileResult) {
    return
  }
  if (!mockState.votes || mockState.votes.length < 1) {
    mockState.exileResult = { noOut: true }
    return
  }
  const voteCount = {}
  mockState.votes.forEach(item => {
    voteCount[item.to] = (voteCount[item.to] || 0) + 1
  })
  const max = Math.max(...Object.values(voteCount))
  const winners = Object.keys(voteCount).filter(username => voteCount[username] === max)
  if (winners.length !== 1) {
    mockState.exileResult = { noOut: true }
    return
  }
  const target = mockPlayers.find(item => item.username === winners[0])
  if (!target) {
    mockState.exileResult = { noOut: true }
    return
  }
  target.status = 0
  target.outReason = 'vote'
  mockState.exileResult = {
    noOut: false,
    target: clone(target),
    count: max,
  }
}

const markMockPlayerOut = (username, outReason) => {
  const target = mockPlayers.find(item => item.username === username)
  if (!target) {
    return null
  }
  target.status = 0
  target.outReason = outReason
  return target
}

const getRecord = () => {
  const day1Content = [
    {
      isTitle: true,
      content: {
        type: 'text',
        text: '第1天 游戏进行中',
        level: 3,
      },
    },
  ]

  if (mockState.votes.length > 0) {
    const selfPlayer = getMockSelfPlayer()
    mockState.votes.forEach(item => {
      const target = mockPlayers.find(player => player.username === item.to)
      if (!target) {
        return
      }
      day1Content.push({
        isTitle: false,
        content: {
          type: 'vote',
          actionName: '投票',
          text: `${selfPlayer.position}号投票给了${target.position}号玩家（${target.name}）`,
          action: 'vote',
          level: 4,
          from: {
            username: selfPlayer.username,
            name: `${selfPlayer.position}号`,
            position: null,
            role: null,
            camp: null,
          },
          to: {
            username: target.username,
            name: `${target.position}号（共${mockState.votes.filter(vote => vote.to === target.username).length}票）`,
            position: target.position,
            role: null,
            camp: null,
          },
        },
      })
    })
  }

  if (mockState.exileResult) {
    if (mockState.exileResult.noOut) {
      day1Content.push({
        isTitle: false,
        content: {
          type: 'text',
          text: '本轮无人获得放逐票，没有玩家出局。',
          level: 2,
        },
      })
    } else {
      const target = mockState.exileResult.target
      day1Content.push({
        isTitle: false,
        content: {
          type: 'action',
          actionName: '放逐',
          action: 'out',
          text: `${target.position}号玩家（${target.name}）获得最高票数，出局！`,
          level: 2,
          from: {
            username: target.username,
            name: target.name,
            position: target.position,
            role: target.role,
            camp: target.camp,
            status: target.status,
          },
          to: {
            role: 'exile',
            name: '放逐出局',
          },
        },
      })
    }
  }

  const nightActions = mockState.actions.filter(item => ['check', 'assault', 'poison', 'shoot'].includes(item.action))
  nightActions.forEach(item => {
    const target = mockPlayers.find(player => player.username === item.to)
    const from = item.from === 'system' ? null : mockPlayers.find(player => player.username === item.from)
    if (!target) {
      return
    }
    const actionNameMap = {
      check: '查验',
      assault: '袭击',
      poison: '毒药',
      shoot: '开枪',
    }
    day1Content.push({
      isTitle: false,
      content: {
        type: 'action',
        actionName: actionNameMap[item.action] || item.action,
        action: item.action,
        text: `${from ? from.position + '号玩家（' + from.name + '）' : '系统'}${actionNameMap[item.action] || item.action}了${target.position}号玩家（${target.name}）`,
        level: item.action === 'check' ? 4 : 2,
        from: from ? {
          username: from.username,
          name: from.name,
          position: from.position,
          role: from.role,
          camp: from.camp,
          status: from.status,
        } : {
          username: null,
          name: '系统',
          position: null,
          role: null,
          camp: null,
        },
        to: {
          username: target.username,
          name: target.name,
          position: target.position,
          role: target.role,
          camp: target.camp,
        },
      },
    })
  })

  if (day1Content.length === 1) {
    day1Content.push({
      isTitle: false,
      content: {
        type: 'text',
        text: '这里会展示真实游戏中的行动、投票和系统播报。',
        level: 1,
      },
    })
  }

  return {
    day0: {
      key: 'day0',
      content: [
        {
          isTitle: true,
          content: {
            type: 'text',
            text: '第0夜 身份确认',
            level: 4,
          },
        },
        {
          isTitle: false,
          content: {
            type: 'rich-text',
            content: [
              { text: '你被分配为', level: 1 },
              { text: getMockSelfPlayer().roleName, level: 6 },
              { text: '，' + (mockRoleProfiles[getMockSelfPlayer().role] || mockRoleProfiles.hunter).recordTip, level: 1 },
            ],
          },
        },
      ],
    },
    day1: {
      key: 'day1',
      content: day1Content,
    },
  }
}

const resolveActionTarget = (config) => {
  const username = config.params && config.params.username
  const target = mockPlayers.find(item => item.username === username) || mockPlayers[1]
  return clone(target)
}

export const isMockEnabled = () => {
  if (process.env.REACT_APP_MOCK === 'true') {
    return true
  }
  if (process.env.REACT_APP_MOCK === 'false') {
    return false
  }
  try {
    return window.localStorage.getItem('WEREWOLF_MOCK') === 'true'
  } catch (e) {
    return false
  }
}

export const isMockToken = (token) => token === MOCK_TOKEN

export const mockFetch = (config = {}) => {
  const url = config.url || ''

  return new Promise((resolve) => {
    setTimeout(() => {
      if (url === '/api/login') {
        resolve({
          accessToken: MOCK_TOKEN,
          user: clone(mockState.user),
        })
        return
      }

      if (url === '/api/register') {
        resolve({ _id: 'mock-register-user' })
        return
      }

      if (url === '/api/user/getUserInfo/auth') {
        resolve(clone(mockState.user))
        return
      }

      if (url === '/api/user/create/auth') {
        resolve({ _id: 'mock-created-user' })
        return
      }

      if (url === '/api/route/auth') {
        resolve([])
        return
      }

      if (url === '/api/permission/ui/auth') {
        resolve([
          { key: 'system.admin', permKey: 'system.admin', roles: ['admin'] },
        ])
        return
      }

      if (url === '/api/room/create/auth') {
        mockState.room = createRoom(0)
        mockState.isOb = false
        resolve({ _id: MOCK_ROOM_ID })
        return
      }

      if (url === '/api/room/join/auth') {
        mockState.isOb = false
        resolve(MOCK_ROOM_ID)
        return
      }

      if (url === '/api/game/ob/auth') {
        mockState.room = createRoom(1)
        mockState.stage = 5
        mockState.gameStatus = 1
        mockState.isOb = true
        mockState.votes = []
        mockState.exileResult = null
        mockState.actions = []
        mockState.speechRecords = []
        mockState.winner = null
        resolve(MOCK_ROOM_ID)
        return
      }

      if (url === '/api/room/info/auth') {
        resolve(clone(mockState.room))
        return
      }

      if (url === '/api/room/seat/auth') {
        resolve({ success: true })
        return
      }

      if (url === '/api/room/kick/auth') {
        resolve({ success: true })
        return
      }

      if (url === '/api/room/quit/auth') {
        mockState.room = createRoom(0)
        mockState.stage = 0
        mockState.isOb = false
        mockState.votes = []
        mockState.exileResult = null
        mockState.actions = []
        mockState.speechRecords = []
        mockState.winner = null
        resolve({ success: true })
        return
      }

      if (url === '/api/room/modifyName/auth') {
        if (config.params && config.params.name) {
          mockState.user.name = config.params.name
        }
        resolve({ success: true })
        return
      }

      if (url === '/api/game/start/auth') {
        resetMockPlayers()
        applyMockSelfRole()
        mockState.room = createRoom(1)
        mockState.stage = 0
        mockState.gameStatus = 1
        mockState.isOb = false
        mockState.votes = []
        mockState.exileResult = null
        mockState.actions = []
        mockState.speechRecords = []
        mockState.winner = null
        resolve({ _id: MOCK_GAME_ID })
        return
      }

      if (url === '/api/game/info/auth') {
        resolve(clone(getMockGame()))
        return
      }

      if (url === '/api/game/nextStage/auth' || url === '/api/game/userNextStage/auth') {
        const index = stageMap.findIndex(item => item.stage === mockState.stage)
        const next = stageMap[index + 1] || stageMap[1]
        if (next.stage === 7) {
          settleMockVote()
        }
        if (mockState.stage === 7 && next.stage === 1) {
          mockState.votes = []
          mockState.exileResult = null
          mockState.actions = []
        }
        mockState.stage = next.stage
        resolve(clone(getMockGame()))
        return
      }

      if (url === '/api/game/wolfSuggestions/auth') {
        const aliveWolf = mockPlayers.find(item => item.role === 'wolf' && item.status === 1 && item.username !== mockUser.username)
        const target = mockPlayers.find(item => item.role !== 'wolf' && item.status === 1 && item.username !== mockUser.username)
        resolve({
          hasAiWolf: !!aliveWolf,
          suggestions: aliveWolf && target ? [
            {
              aiId: aliveWolf.username,
              content: {
                target: target.username,
                speechText: `建议今晚优先观察${target.position}号（${target.name}），他的白天发言最容易带节奏。`,
              },
            },
          ] : [],
        })
        return
      }

      if (url === '/api/game/record/auth') {
        resolve(clone(getRecord()))
        return
      }

      if (url === '/api/game/votePlayer/auth') {
        const target = resolveActionTarget(config)
        const selfPlayer = getMockSelfPlayer()
        mockState.votes = (mockState.votes || []).filter(item => item.from !== selfPlayer.username)
        mockState.votes.push({
          from: selfPlayer.username,
          to: target.username,
          day: 1,
          stage: mockState.stage,
          action: 'vote',
        })
        mockState.exileResult = null
        resolve({
          username: target.username,
          name: target.name,
          position: target.position,
        })
        return
      }

      if (url === '/api/game/assaultPlayer/auth') {
        const target = resolveActionTarget(config)
        const selfPlayer = getMockSelfPlayer()
        mockState.actions = (mockState.actions || []).filter(item => !(item.from === selfPlayer.username && item.stage === 2 && item.action === 'assault'))
        mockState.actions.push({
          from: selfPlayer.username,
          to: target.username,
          day: 1,
          stage: mockState.stage,
          action: 'assault',
        })
        markMockPlayerOut(target.username, 'assault')
        resolve({
          username: target.username,
          name: target.name,
          position: target.position,
        })
        return
      }

      if (url === '/api/game/checkPlayer/auth') {
        const target = resolveActionTarget(config)
        const selfPlayer = getMockSelfPlayer()
        mockState.actions = (mockState.actions || []).filter(item => !(item.from === selfPlayer.username && item.stage === 1 && item.action === 'check'))
        mockState.actions.push({
          from: selfPlayer.username,
          to: target.username,
          day: 1,
          stage: mockState.stage,
          action: 'check',
        })
        resolve({
          username: target.username,
          name: target.name,
          position: target.position,
          camp: target.camp,
          campName: target.campName,
        })
        return
      }

      if (url === '/api/game/poisonPlayer/auth') {
        const target = resolveActionTarget(config)
        const selfPlayer = getMockSelfPlayer()
        mockState.actions = (mockState.actions || []).filter(item => !(item.from === selfPlayer.username && item.stage === 3 && ['antidote', 'poison'].includes(item.action)))
        mockState.actions.push({
          from: selfPlayer.username,
          to: target.username,
          day: 1,
          stage: mockState.stage,
          action: 'poison',
        })
        markMockPlayerOut(target.username, 'poison')
        resolve({
          username: target.username,
          name: target.name,
          position: target.position,
        })
        return
      }

      if (url === '/api/game/shootPlayer/auth') {
        const target = resolveActionTarget(config)
        const selfPlayer = getMockSelfPlayer()
        mockState.actions.push({
          from: selfPlayer.username,
          to: target.username,
          day: 1,
          stage: mockState.stage,
          action: 'shoot',
        })
        markMockPlayerOut(target.username, 'shoot')
        resolve({
          username: target.username,
          name: target.name,
          position: target.position,
        })
        return
      }

      if (url === '/api/game/antidotePlayer/auth') {
        const selfPlayer = getMockSelfPlayer()
        const assaultAction = [...(mockState.actions || [])].reverse().find(item => item.action === 'assault')
        const target = assaultAction && mockPlayers.find(item => item.username === assaultAction.to)
        mockState.actions = (mockState.actions || []).filter(item => !(item.from === selfPlayer.username && item.stage === 3 && ['antidote', 'poison'].includes(item.action)))
        mockState.actions.push({
          from: selfPlayer.username,
          to: target ? target.username : null,
          day: 1,
          stage: mockState.stage,
          action: 'antidote',
        })
        if (target) {
          target.status = 1
          delete target.outReason
        }
        resolve(target ? {
          username: target.username,
          name: target.name,
          position: target.position,
        } : { success: true })
        return
      }

      if (url === '/api/game/boomPlayer/auth') {
        const selfPlayer = getMockSelfPlayer()
        mockState.actions.push({
          from: selfPlayer.username,
          to: selfPlayer.username,
          day: 1,
          stage: mockState.stage,
          action: 'boom',
        })
        markMockPlayerOut(selfPlayer.username, 'boom')
        resolve({
          username: selfPlayer.username,
          name: selfPlayer.name,
          position: selfPlayer.position,
        })
        return
      }

      if (url === '/api/game/result/auth') {
        const requestedWinner = config.params && config.params.winner !== undefined
          ? Number(config.params.winner)
          : (mockState.winner !== null ? mockState.winner : 1)
        const winner = requestedWinner === 0 ? 0 : 1
        mockState.winner = winner
        mockState.gameStatus = 2
        resolve({
          winner,
          winnerString: winner === 0 ? '狼人阵营' : '好人阵营',
        })
        return
      }

      if (url === '/api/game/destroy/auth') {
        mockState.gameStatus = 2
        resolve({ success: true })
        return
      }

      if (url === '/api/game/again/auth') {
        resetMockPlayers()
        mockState.room = createRoom(0)
        mockState.stage = 0
        mockState.gameStatus = 1
        mockState.isOb = false
        mockState.votes = []
        mockState.exileResult = null
        mockState.actions = []
        mockState.speechRecords = []
        mockState.winner = null
        resolve({ _id: MOCK_ROOM_ID })
        return
      }

      if (url === '/api/game/replay/auth') {
        resolve({
          message: '复盘分析完成',
          result: {
            gameRecord: {
              game_id: MOCK_GAME_ID,
              room_id: MOCK_ROOM_ID,
              days: 1,
              winner: 1,
            },
            analysisFiles: {
              text: 'mock-replay.txt',
              json: 'mock-replay.json',
            },
          },
        })
        return
      }

      if (url === '/api/game/replay/health/auth') {
        resolve({ ok: true })
        return
      }

      if (url === '/api/game/replay/player/history/auth') {
        resolve({
          username: mockUser.username,
          total: 2,
          page: 1,
          limit: 20,
          list: [
            {
              gameId: MOCK_GAME_ID,
              roomId: MOCK_ROOM_ID,
              playerCount: 12,
              mode: 'standard_12',
              days: 3,
              winner: 1,
              winnerLabel: '好人阵营',
              isWin: true,
              player: {
                username: mockUser.username,
                name: mockUser.name,
                position: 2,
                role: 'witch',
                roleName: '女巫',
                camp: 1,
                status: 1,
                outReason: null,
              },
              hasReplay: true,
              replayFiles: {
                json: 'mock-replay.json',
                text: 'mock-replay.txt',
              },
              replayTimestamp: new Date().toISOString(),
              startTime: new Date(Date.now() - 7200000).toISOString(),
              endTime: new Date().toISOString(),
            },
            {
              gameId: MOCK_GAME_ID + '-2',
              roomId: MOCK_ROOM_ID + '-2',
              playerCount: 9,
              mode: 'standard_9',
              days: 2,
              winner: 0,
              winnerLabel: '狼人阵营',
              isWin: false,
              player: {
                username: mockUser.username,
                name: mockUser.name,
                position: 5,
                role: 'villager',
                roleName: '村民',
                camp: 1,
                status: 0,
                outReason: 'vote',
              },
              hasReplay: true,
              replayFiles: {
                json: 'mock-replay-2.json',
                text: 'mock-replay-2.txt',
              },
              replayTimestamp: new Date(Date.now() - 86400000).toISOString(),
              startTime: new Date(Date.now() - 93600000).toISOString(),
              endTime: new Date(Date.now() - 86400000).toISOString(),
            },
          ],
        })
        return
      }

      if (url === '/api/game/replay/detail/auth') {
        resolve({
          gameId: (config.params && config.params.gameId) || MOCK_GAME_ID,
          roomId: MOCK_ROOM_ID,
          winnerLabel: '好人阵营',
          analysisFiles: {
            json: 'mock-replay.json',
            text: 'mock-replay.txt',
          },
          gameRecord: {
            days: 3,
            winner: 1,
            winnerLabel: '好人阵营',
            playerCount: mockPlayers.length,
          },
          players: clone(mockPlayers),
          analysis: {
            json: {
              summary: '好人阵营通过发言交叉验证赢下对局。',
            },
            text: '本局复盘：好人阵营通过连续发言交叉验证，成功缩小狼人范围。女巫保留关键药剂，猎人在白天投票阶段提供了重要压力，最终村庄找到了最后一名狼人。',
          },
        })
        return
      }

      if (url === '/api/voice/speech/auth') {
        const text = (config.data && config.data.text) || '这是一段 mock 发言文本'
        const record = saveMockSpeechRecord('speech', text)
        resolve({
          text,
          recordId: record._id,
          from: record.from,
          nextSpeaker: null,
        })
        return
      }

      if (url === '/api/voice/stt/auth') {
        resolve({ text: '这是一段 mock 语音识别结果' })
        return
      }

      if (url === '/api/game/saveLastWords/auth') {
        const text = (config.data && (config.data.content || config.data.text)) || '这是 mock 遗言'
        const record = saveMockSpeechRecord('lastWords', text)
        resolve({
          message: '遗言保存成功',
          data: {
            _id: record._id,
          },
          nextSpeaker: null,
        })
        return
      }

      resolve({})
    }, 250)
  })
}
