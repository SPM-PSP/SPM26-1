const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const wrapResult = (success, msg, code) => {
  if(success){
    return { result: true, data: msg }
  }
  return { result: false, errorMessage: msg, errorCode: code }
}

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'werewolf-replay-test-'))

const testHelperBasics = async () => {
  const helper = require('../../server/extend/helper')({
    $config: {
      crypto: { secret: 'test-secret' },
      jwt: { secret: 'jwt-secret' },
    },
  })

  assert.deepStrictEqual(helper.Result.success('ok'), {
    success: true,
    data: 'ok',
    errorCode: null,
    errorMessage: null,
  })
  assert.strictEqual(helper.wrapResult(false, 'bad', -1).errorMessage, 'bad')
  assert.strictEqual(helper.isEmpty(''), true)
  assert.strictEqual(helper.formatDateYYMMDD(new Date('2026-05-29T01:02:03')), '2026-05-29')
  assert.strictEqual(helper.findMaxInArray(['a', 'b', 'a']), 'a')
  assert.deepStrictEqual(helper.findMaxValue(['a', 'b', 'a', 'b']), ['a', 'b'])

  const password = await helper.createPassword('123456')
  assert.strictEqual(await helper.checkPassword('123456', password), true)
  assert.strictEqual(await helper.checkPassword('wrong', password), false)

  const token = await helper.createToken({ _id: 1, username: 'host', roles: ['player'] })
  const decoded = await helper.checkToken(token)
  assert.strictEqual(decoded.username, 'host')
}

const testAuthMiddleware = async () => {
  const authMiddlewareFactory = require('../../server/middleware/auth')
  let nextCalled = 0
  const makeCtx = (url, authorization = 'token') => ({
    request: { url },
    header: { authorization },
    body: null,
    userInfo: null,
  })
  const app = {
    $helper: {
      checkToken: async token => token === 'valid-token',
      decodeToken: async () => ({ username: 'host', roles: ['player'] }),
      Result: {
        fail: (code, message) => ({ success: false, errorCode: code, errorMessage: message }),
        error: key => ({ success: false, errorKey: key }),
      },
    },
    $nodeCache: {
      get: () => [],
    },
  }
  const middleware = authMiddlewareFactory(app)

  const publicCtx = makeCtx('/api/login')
  await middleware(publicCtx, async () => { nextCalled += 1 })
  assert.strictEqual(nextCalled, 1)

  const deniedCtx = makeCtx('/api/game/info/auth', 'bad-token')
  await middleware(deniedCtx, async () => { nextCalled += 1 })
  assert.deepStrictEqual(deniedCtx.body, { success: false, errorKey: 'NOT_LOGIN' })

  const authedCtx = makeCtx('/api/game/info/auth', 'valid-token')
  await middleware(authedCtx, async () => { nextCalled += 1 })
  assert.strictEqual(authedCtx.userInfo.username, 'host')
  assert.strictEqual(nextCalled, 2)
}

const testUserService = async () => {
  const calls = []
  const created = []
  const userModel = {
    findOne: async query => {
      calls.push(['findOne', query])
      if(query.where.username === 'missing'){
        return null
      }
      return { _id: 1, username: query.where.username, name: 'Host' }
    },
    findByPk: async id => ({ _id: id, username: 'host' }),
    create: async payload => {
      created.push(payload)
      return payload
    },
  }
  const userService = require('../../server/service/userService')({
    $model: { user: userModel },
  })

  assert.strictEqual(await userService.getUsersByUsername(''), null)
  assert.strictEqual((await userService.getUsersByUsername('host')).username, 'host')
  assert.deepStrictEqual(calls[0][1].attributes, { exclude: ['password'] })

  const passwordRow = await userService.getUsersPasswordByUsername('host')
  assert.strictEqual(passwordRow.username, 'host')
  assert.deepStrictEqual(calls[1][1].attributes, ['password'])

  const createdUser = await userService.createUser('new_user', 'pwd')
  assert.strictEqual(created.length, 1)
  assert.strictEqual(created[0].defaultRole, 'player')
  assert.strictEqual(createdUser.username, 'new_user')
  assert.deepStrictEqual(await userService.getUserInfoById(9), { _id: 9, username: 'host' })
}

const testRoomService = async () => {
  const roomModel = { name: 'room' }
  const userModel = { name: 'user' }
  const roomData = {
    _id: 10,
    count: 3,
    v1: 'host',
    v2: null,
    v3: 'guest',
    ob: JSON.stringify(['viewer']),
    toJSON(){
      return { ...this }
    },
  }
  const app = {
    $constants: { maxSeatCount: 12 },
    $helper: { wrapResult },
    $model: { room: roomModel, user: userModel },
    $service: {
      baseService: {
        queryById: async (model, id) => {
          assert.strictEqual(model, roomModel)
          return id === 10 ? roomData : null
        },
        queryOne: async (model, query) => {
          assert.strictEqual(model, userModel)
          return { username: query.username, name: query.username + '_name' }
        },
      },
    },
  }
  const roomService = require('../../server/service/roomService')(app)

  const seated = await roomService.findInSeatPlayer(10, 'host')
  assert.strictEqual(seated.result, true)

  const missingSeat = await roomService.findInSeatPlayer(10, 'nobody')
  assert.strictEqual(missingSeat.result, false)

  const seats = await roomService.getRoomSeatPlayer(10)
  assert.strictEqual(seats.result, true)
  assert.strictEqual(seats.data.length, 3)
  assert.strictEqual(seats.data[0].player.username, 'host')
  assert.strictEqual(seats.data[1].player, null)

  const observer = await roomService.isOb(10, 'viewer')
  assert.deepStrictEqual(observer, { result: true, data: 'Y' })
  const notObserver = await roomService.isOb(10, 'host')
  assert.deepStrictEqual(notObserver, { result: true, data: 'N' })
}

const testGameServiceSettleGameOver = async () => {
  const gameModel = { name: 'game' }
  const playerModel = { name: 'player' }
  const setGameWinCalls = []
  const makeService = (queryImpl) => {
    const app = {
      $helper: { wrapResult },
      $model: { game: gameModel, player: playerModel },
      $service: {
        baseService: {
          queryById: async () => ({
            _id: 1,
            roomId: 2,
            winCondition: 1,
          }),
          query: queryImpl,
        },
        gameService: {
          setGameWin: async (id, camp) => {
            setGameWinCalls.push({ id, camp })
            return wrapResult(true, camp === 0 ? 'wolf' : 'good')
          },
        },
      },
    }
    return require('../../server/service/gameService')(app)
  }

  let gameService = makeService(async (model, query) => {
    if(query.camp === 1) return []
    return [{ username: 'x' }]
  })
  let result = await gameService.settleGameOver(1)
  assert.strictEqual(result.data, 'wolf')
  assert.deepStrictEqual(setGameWinCalls.pop(), { id: 1, camp: 0 })

  gameService = makeService(async (model, query) => {
    if(query.camp === 1) return [{ username: 'good' }]
    if(query.role === 'villager') return [{ username: 'villager' }]
    if(query.role && query.role.$in) return [{ username: 'witch' }]
    if(query.role === 'wolf') return []
    return []
  })
  result = await gameService.settleGameOver(1)
  assert.strictEqual(result.data, 'good')
  assert.deepStrictEqual(setGameWinCalls.pop(), { id: 1, camp: 1 })

  gameService = makeService(async () => [{ username: 'alive' }])
  result = await gameService.settleGameOver(1)
  assert.deepStrictEqual(result, { result: true, data: 'N' })
}

const loadReplayServiceWithAxios = (mockAxios) => {
  const axiosPath = require.resolve('axios')
  const replayServicePath = path.resolve(__dirname, '../../server/service/replayService.js')
  const originalAxiosCache = require.cache[axiosPath]
  const originalReplayCache = require.cache[replayServicePath]

  require.cache[axiosPath] = {
    id: axiosPath,
    filename: axiosPath,
    loaded: true,
    exports: mockAxios,
  }
  delete require.cache[replayServicePath]

  const replayServiceFactory = require(replayServicePath)

  return {
    replayServiceFactory,
    restore: () => {
      delete require.cache[replayServicePath]
      if(originalReplayCache){
        require.cache[replayServicePath] = originalReplayCache
      }
      if(originalAxiosCache){
        require.cache[axiosPath] = originalAxiosCache
      } else {
        delete require.cache[axiosPath]
      }
    },
  }
}

const createReplayApp = (models) => ({
  $config: {
    aiReplayService: {
      baseUrl: 'http://mock-replay-service',
      timeout: 1000,
    },
    aiReplayModel: {
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'http://mock-model',
    },
  },
  $helper: {
    wrapResult,
  },
  $log4: {
    errorLogger: {
      error: () => {},
    },
  },
  $model: models,
  $service: {
    baseService: {
      query: async (model) => {
        if(model === models.player){
          return [
            {
              username: 'host',
              name: 'Host',
              position: 1,
              role: 'villager',
              camp: 1,
              status: 1,
              outReason: null,
            },
            {
              username: 'ai_1',
              name: 'AI 1',
              position: 2,
              role: 'wolf',
              camp: 0,
              status: 0,
              outReason: 'vote',
            },
          ]
        }
        if(model === models.record){
          return [
            {
              day: 1,
              stage: 5,
              createdAt: '2026-05-29T10:00:00.000Z',
              content: {
                type: 'speech',
                text: 'hello',
              },
            },
          ]
        }
        if(model === models.action){
          return [
            {
              day: 1,
              action: 'vote',
              to: 'ai_1',
            },
          ]
        }
        return []
      },
    },
  },
})

const testEnsureReplayCreatesIndexAndSkipsDuplicate = async () => {
  const outputDir = makeTempDir()
  const models = {
    game: { name: 'game' },
    player: { name: 'player' },
    record: { name: 'record' },
    action: { name: 'action' },
    gameTag: { name: 'gameTag' },
  }
  const axiosCalls = []
  const mockAxios = async (config) => {
    axiosCalls.push(config)
    fs.mkdirSync(config.data.output_dir, { recursive: true })
    const jsonFile = path.join(config.data.output_dir, 'ai_replay_test.json')
    const textFile = path.join(config.data.output_dir, 'ai_replay_test.txt')
    fs.writeFileSync(jsonFile, JSON.stringify({ summary_report: 'ok' }), 'utf8')
    fs.writeFileSync(textFile, 'ok', 'utf8')
    return {
      data: {
        success: true,
        result: {
          json: jsonFile,
          text: textFile,
        },
        timestamp: '2026-05-29T10:01:00.000Z',
      },
    }
  }
  mockAxios.get = async () => ({ data: { status: 'ok' } })

  const { replayServiceFactory, restore } = loadReplayServiceWithAxios(mockAxios)
  try {
    const app = createReplayApp(models)
    const replayService = replayServiceFactory(app)
    const gameInstance = {
      _id: 101,
      roomId: 9001,
      createdAt: '2026-05-29T09:00:00.000Z',
      updatedAt: '2026-05-29T10:00:00.000Z',
      playerCount: 2,
      mode: 'standard_6',
      winner: 1,
      day: 1,
    }

    const first = await replayService.ensureGameReplay(gameInstance, { outputDir })
    assert.strictEqual(first.result, true)
    assert.strictEqual(axiosCalls.length, 1)

    const index = replayService.readReplayIndex(outputDir)
    assert.strictEqual(index.length, 1)
    assert.strictEqual(String(index[0].gameId), '101')
    assert.strictEqual(index[0].players.length, 2)
    assert.strictEqual(index[0].players[0].username, 'host')
    assert.ok(index[0].analysisFiles.json.endsWith('ai_replay_test.json'))

    const second = await replayService.ensureGameReplay(gameInstance, { outputDir })
    assert.strictEqual(second.result, true)
    assert.strictEqual(second.data.reused, true)
    assert.strictEqual(axiosCalls.length, 1)
  } finally {
    restore()
    fs.rmSync(outputDir, { recursive: true, force: true })
  }
}

const testSetGameWinTriggersReplayOnce = async () => {
  const gameModel = { name: 'game' }
  const recordModel = { name: 'record' }
  const sentMessages = []
  const savedRecords = []
  const replayTriggers = []
  const gameInstance = {
    _id: 202,
    roomId: 3001,
    day: 2,
    stage: 6,
    toJSON(){
      return {
        _id: this._id,
        roomId: this.roomId,
        day: this.day,
        stage: this.stage,
      }
    },
  }
  const updatedGameInstance = {
    ...gameInstance.toJSON(),
    status: 2,
    winner: 1,
  }
  const app = {
    $model: {
      game: gameModel,
      record: recordModel,
    },
    $helper: {
      wrapResult,
    },
    $service: {
      baseService: {
        queryById: async (model, id) => {
          assert.strictEqual(model, gameModel)
          assert.strictEqual(id, 202)
          return gameInstance
        },
        updateById: async (model, id, update) => {
          assert.strictEqual(model, gameModel)
          assert.strictEqual(id, 202)
          assert.deepStrictEqual(update, { status: 2, winner: 1 })
          return updatedGameInstance
        },
        save: async (model, record) => {
          assert.strictEqual(model, recordModel)
          savedRecords.push(record)
          return record
        },
      },
      replayService: {
        triggerGameReplay: (game) => {
          replayTriggers.push(game)
        },
      },
    },
    $ws: {
      connections: [
        {
          path: '/lrs/3001',
          sendText: (message) => sentMessages.push(message),
        },
      ],
    },
  }

  const gameService = require('../../server/service/gameService')(app)
  const result = await gameService.setGameWin(202, 1)

  assert.strictEqual(result.result, true)
  assert.strictEqual(result.data, 'Y')
  assert.strictEqual(savedRecords.length, 1)
  assert.strictEqual(replayTriggers.length, 1)
  assert.strictEqual(replayTriggers[0].status, 2)
  assert.strictEqual(replayTriggers[0].winner, 1)
  assert.strictEqual(sentMessages[0], 'gameOver')
  assert.deepStrictEqual(JSON.parse(sentMessages[1]), {
    type: 'stageCue',
    roomId: 3001,
    gameId: 202,
    day: 2,
    stage: 'gameOver',
    text: '游戏结算，好人阵营获得胜利。'
  })
}

const run = async () => {
  const tests = [
    ['helper basics', testHelperBasics],
    ['auth middleware', testAuthMiddleware],
    ['userService queries and create', testUserService],
    ['roomService seats and observers', testRoomService],
    ['gameService settleGameOver', testGameServiceSettleGameOver],
    ['ensureGameReplay creates index and skips duplicate', testEnsureReplayCreatesIndexAndSkipsDuplicate],
    ['setGameWin triggers automatic replay', testSetGameWinTriggersReplayOnce],
  ]

  for(const [name, test] of tests){
    await test()
    console.log('[PASS] ' + name)
  }
}

run().catch(error => {
  console.error('[FAIL]', error)
  process.exit(1)
})
