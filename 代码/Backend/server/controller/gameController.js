module.exports = app => ({

  /**
   * @api {post} /api/game/start/auth 开始游戏
   * @apiGroup 游戏模块
   */
  async gameStart (ctx) {
    const { $service, $helper, $model, $constants, $support,$ws } = app
    const { room, game, user, player, vision, record } = $model
    const { gameModeMap, skillMap } = $constants
    let { id, setting } = ctx.request.body
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!setting){
      setting = {}
    }
    let roomInstance = await $service.baseService.queryById(room, id)
    // 转换为纯 JSON 对象，避免 Sequelize 代理问题
    roomInstance = roomInstance.toJSON ? roomInstance.toJSON() : roomInstance
    let currentUser = await $service.baseService.userInfo(ctx)
    if(roomInstance.owner !== currentUser.username){
      ctx.body = $helper.Result.fail(-1,'该房间不是你创建的，无法开始游戏！')
      return
    }

    let requestedPlayerCount = setting.playerCount ? parseInt(setting.playerCount) : roomInstance.count || 9
    if(requestedPlayerCount < 6 || requestedPlayerCount > 12){
      requestedPlayerCount = roomInstance.count || 9
    }

    let r = await $service.roomService.getRoomSeatPlayer(id)
    if(!r.result){
      ctx.body = $helper.Result.fail(r.errorCode, r.errorMessage)
      return
    }
    let seatInfo = r.data
    let requiredSeats = seatInfo.filter(item => item.position <= requestedPlayerCount)
    let missingSeatCount = requiredSeats.filter(item => !item.player).length
    let autoAiPlayers = []
    if(missingSeatCount > 0){
      let aiResult = await $service.aiService.createAiSeatPlayers(ctx, id, missingSeatCount)
      if(!aiResult.result){
        ctx.body = $helper.Result.fail(aiResult.errorCode, aiResult.errorMessage)
        return
      }
      autoAiPlayers = aiResult.data || []
      roomInstance = await $service.baseService.queryById(room, id)
      roomInstance = roomInstance.toJSON ? roomInstance.toJSON() : roomInstance
      r = await $service.roomService.getRoomSeatPlayer(id)
      if(!r.result){
        ctx.body = $helper.Result.fail(r.errorCode, r.errorMessage)
        return
      }
      seatInfo = r.data
      requiredSeats = seatInfo.filter(item => item.position <= requestedPlayerCount)
    }
    let seatStatus = requiredSeats.every(item => !!item.player)
    if(!seatStatus){
      ctx.body = $helper.Result.fail(-1,'座位未坐满，需要' + requestedPlayerCount + '人才能开始游戏！')
      return
    }

    // 获取房间配置的人数，作为该局游戏的玩家数
    let playerCount = requestedPlayerCount
    if(playerCount < 6 || playerCount > 12){
      playerCount = 9 // 默认9人
    }
    let mode = 'standard_' + playerCount
    let aiSeatPlayers = []
    console.log('\n🔍 检查房间座位配置:')
    for(let i = 1; i <= playerCount; i++){
      let username = roomInstance['v' + i]
      console.log(`  ${i}号位: ${username}`)
      if($service.aiService.isAiId(username)){
        console.log(`    ✅ 检测到AI玩家: ${username} (座位${i})`)
        aiSeatPlayers.push({
          seat: i,
          aiId: username,
          username: username
        })
      } else {
        console.log(`    👤 检测到真人玩家: ${username} (座位${i})`)
      }
    }
    console.log(`\n📋 最终AI座位玩家: ${JSON.stringify(aiSeatPlayers, null, 2)}`)
    
    // 动态生成座位字段 v1-v12
    let gameObject = {
      roomId: roomInstance._id,
      owner: roomInstance.owner,
      status: 1,
      stage: 0, // 阶段
      day: 1, // 第一天
      playerCount: playerCount,
      p1: setting.p1 || 30,
      p2: setting.p2 || 45,
      p3: setting.p3 || 30,
      witchSaveSelf: setting.witchSaveSelf || 2,
      winCondition: setting.winCondition || 1,
      flatTicket: setting.flatTicket || 1,
      mode: mode // 根据人数动态设置
    }
    
    // 动态添加座位字段 v1 到 v12
    for(let i = 1; i <= 12; i++){
      gameObject['v' + i] = roomInstance['v' + i]
    }

    // 创建游戏实例
    let gameInstance = await $service.baseService.save(game, gameObject)

    // 身份配置处理
    const { getRoleConfig, validateRoleConfig } = require('./roleConfig')
    const standard9RoleArray = gameModeMap[mode]
    
    // 获取身份配置
    let roleConfig = getRoleConfig(roomInstance._id, playerCount)
    
    let randomPlayers
    if (roleConfig) {
      console.log('\n🎯 使用身份配置文件分配角色')
      console.log('📋 配置信息:', JSON.stringify(roleConfig, null, 2))
      
      // 验证配置
      let validation = validateRoleConfig(roleConfig, standard9RoleArray, playerCount)
      
      if (validation.isValid) {
        console.log(`✅ ${validation.message}`)
        
        // 使用配置的角色分配
        let usedPositions = new Set(roleConfig.map(c => c.position))
        let remainingRoles = [...standard9RoleArray]
        
        // 移除已配置的角色
        for (let config of roleConfig) {
          let index = remainingRoles.indexOf(config.role)
          if (index > -1) {
            remainingRoles.splice(index, 1)
          }
        }
        
        // 为剩余位置随机分配角色
        let allAssignments = [...roleConfig]
        let remainingPositions = []
        
        for (let i = 1; i <= playerCount; i++) {
          if (!usedPositions.has(i)) {
            remainingPositions.push(i)
          }
        }
        
        // 随机分配剩余角色
        let shuffledRoles = remainingRoles.sort(() => Math.random() - 0.5)
        for (let i = 0; i < remainingPositions.length && i < shuffledRoles.length; i++) {
          allAssignments.push({
            position: remainingPositions[i],
            role: shuffledRoles[i]
          })
        }
        
        // 按位置排序并转换为标准格式
        allAssignments.sort((a, b) => a.position - b.position)
        randomPlayers = allAssignments.map(assignment => ({
          number: assignment.position,
          role: assignment.role
        }))
        
      } else {
        console.log(`❌ 身份配置验证失败: ${validation.message}`)
        console.log('🎲 使用随机角色分配')
        randomPlayers = $helper.getRandomNumberArray(1, playerCount, playerCount, standard9RoleArray)
      }
    } else {
      console.log('🎲 使用随机角色分配')
      randomPlayers = $helper.getRandomNumberArray(1, playerCount, playerCount, standard9RoleArray)
    }
    
    // 创建玩家
    let aiRolePlayers = []
    console.log('\n🎮 最终角色分配结果:')
    
    for(let i = 0; i < randomPlayers.length; i++){
      let item = randomPlayers[i]
      let randomUser = await $service.baseService.queryOne(user,  {username: roomInstance['v' + (item.number)]})
      let p = {
        roomId: roomInstance._id,
        gameId: gameInstance._id,
        userId: randomUser._id,
        username: roomInstance['v' + (item.number)],
        name: randomUser.name,
        role: item.role,
        camp: item.role === 'wolf' ? 0 : 1, // 狼人阵营 ：0 ； 好人阵营：1
        status: 1, // 都是存活状态
        skill: skillMap[item.role],
        position: item.number
      }
      // 依次创建该局游戏的所有玩家
      await $service.baseService.save(player, p)
      
      const isAI = $service.aiService.isAiId(p.username)
      const roleIcon = {
        'wolf': '🐺',
        'predictor': '🔮',
        'witch': '🧙‍♀️', 
        'hunter': '🔫',
        'villager': '👤'
      }[p.role] || '❓'
      
      console.log(`${roleIcon} ${p.name}(${p.username}) - ${p.role}${isAI ? ' (AI)' : ' (真人)'}`)
      
      if($service.aiService.isAiId(p.username)){
        aiRolePlayers.push({
          username: p.username,
          role: p.role
        })
      }
    }
    console.log('=====================================\n')

    // 强制执行bootstrap，确保AI服务初始化
    console.log('\n🔄 强制执行AI服务bootstrap...')
    const bootstrapResult = await $service.aiService.bootstrapGame(gameInstance, aiSeatPlayers.length, {
      modelPolicy: setting.modelPolicy,
      asyncMode: true
    })
    console.log('🔄 强制Bootstrap结果:', bootstrapResult)
    
    if(!bootstrapResult.result){
      console.log('❌ 强制Bootstrap失败:', bootstrapResult.errorMessage)
    } else {
      console.log('✅ 强制Bootstrap成功!')
    }
    
    if(aiRolePlayers.length > 0){
      let assignResult = await $service.aiService.assignRoles(gameInstance, aiRolePlayers)
      if(!assignResult.result){
        ctx.body = $helper.Result.fail(assignResult.errorCode, assignResult.errorMessage)
        return
      }
    }

    // 创建视野 0：完全未知，1：知晓阵营（一般预言家的视野），2：知晓角色(如狼人同伴)
    for(let i = 0 ; i < randomPlayers.length; i++){
      for(let j = 0 ; j < randomPlayers.length; j++){
        let v = {
          roomId: roomInstance._id,
          gameId: gameInstance._id,
          from: gameInstance['v' + randomPlayers[i].number],
          to: gameInstance['v' + randomPlayers[j].number],
          status: $support.getVisionKey(randomPlayers[i], randomPlayers[j])
        }
        // 创建视野矩阵（playerCount x playerCount）
        await $service.baseService.save(vision, v)
      }
    }

    // AI服务初始化（在玩家和视野都创建完成后）
    console.log('\n🤖 AI服务初始化开始...')
    console.log('📋 AI玩家数量:', aiSeatPlayers.length)
    console.log('📋 AI玩家列表:', aiSeatPlayers)
    
    // 强制执行bootstrap，不跳过AI初始化
    if(aiSeatPlayers.length > 0){
      let bootstrapResult = await $service.aiService.bootstrapGame(gameInstance, aiSeatPlayers.length, {
        modelPolicy: setting.modelPolicy,
        asyncMode: true
      })
      console.log('🔄 Bootstrap结果:', bootstrapResult)
      
      if(!bootstrapResult.result){
        console.log('❌ Bootstrap失败:', bootstrapResult.errorMessage)
        ctx.body = $helper.Result.fail(bootstrapResult.errorCode, bootstrapResult.errorMessage)
        return
      } else {
        console.log('✅ Bootstrap成功!')
      }
    } else {
      console.log('⚠️ 没有AI玩家，跳过Bootstrap')
    }
    
    // 即使没有AI玩家，也要确保bootstrap被调用（为了后续角色分配）
    console.log('\n🔄 强制执行AI服务初始化...')
    let forceBootstrapResult = await $service.aiService.bootstrapGame(gameInstance, 0, {
      modelPolicy: setting.modelPolicy,
      asyncMode: true
    })
    console.log('🔄 强制Bootstrap结果:', forceBootstrapResult)

    // 生产一条游戏开始记录
    let gameStartRecord = {
      roomId: roomInstance._id,
      gameId: gameInstance._id,
      content: {
        text: '游戏开始！',
        type: 'text',
        level: 2,
      },
      isCommon: 1,
      isTitle: 0
    }
    await $service.baseService.save(record, gameStartRecord)

    
    // 改变房间状态, 游戏进行中
    await $service.baseService.updateById(room, roomInstance._id,{ status: 1, gameId: gameInstance._id})

    // 游戏第一阶段记录
    let stageFirstRecord = {
      roomId: roomInstance._id,
      gameId: gameInstance._id,
      content: {
        text: '天黑请闭眼',
        type: 'text',
        level: 1,
      },
      isCommon: 1,
    }
    await $service.baseService.save(record, stageFirstRecord)

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('gameStart')
      }
    })
    ctx.body = $helper.Result.success({
    message:'创建游戏成功！',
    gameId: gameInstance._id,
    players: randomPlayers,
    autoAiPlayers: autoAiPlayers
  })
  },

  /**
   * @api {get} /api/game/info/auth 获取游戏信息
   * @apiGroup 游戏模块
   */
  async getGameInfo (ctx) {
    const { $service, $helper, $model, $constants, $nodeCache } = app
    const { game, player, record } = $model
    const { playerRoleMap, stageMap } = $constants
    const { id } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'该游戏不存在！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    if(currentPlayer){
      isOb = false
    }
    if(!isOb && !currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }

    // 获取当前角色拥有的各个玩家的游戏信息
    let playerInfoResult = await $service.gameService.getPlayerInfoInGame(ctx, gameInstance._id)
    if(!playerInfoResult.result){
      ctx.body = $helper.Result.fail(playerInfoResult.errorCode, playerInfoResult.errorMessage)
      return
    }

    // 重新查询当前玩家状态，确保获取最新的死亡状态（特别是投票出局后）
    if(!isOb){
      currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    }

    // 获取当前玩家的技能状态
    let skillInfo = await $service.gameService.getSkillStatusInGame(ctx, gameInstance._id)
    if(!skillInfo.result){
      ctx.body = $helper.Result.fail(skillInfo.errorCode, skillInfo.errorMessage)
      return
    }

    // 获取游戏公共信息
    let broadcastInfo = await $service.gameService.getBroadcastInfo(ctx, gameInstance._id)
    if(!broadcastInfo.result){
      ctx.body = $helper.Result.fail(broadcastInfo.errorCode, broadcastInfo.errorMessage)
      return
    }

    // 获取玩家的系统提示信息
    let systemTipsInfo = await $service.gameService.getSystemTips(ctx, gameInstance._id)
    if(!systemTipsInfo.result){
      ctx.body = $helper.Result.fail(systemTipsInfo.errorCode, systemTipsInfo.errorMessage)
      return
    }

    // 获取玩家的非角色技能状态（如投票）
    let actionInfo = await $service.gameService.getActionStatusInGame(ctx, gameInstance._id)
    if(!actionInfo.result){
      ctx.body = $helper.Result.fail(actionInfo.errorCode, actionInfo.errorMessage)
      return
    }

    let speechRecordList = await $service.baseService.query(record, {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      isCommon: 1
    }, {}, { sort: { _id: -1 }, limit: 20 })
    speechRecordList = speechRecordList || []
    console.log('获取到的所有记录:', speechRecordList.map(item => ({_id: item._id, type: item.content?.type, text: item.content?.text})))
    speechRecordList = speechRecordList
      .filter(item => item.content && (item.content.type === 'speech' || item.content.type === 'lastWords'))
      .reverse()
    console.log('过滤后的记录:', speechRecordList.map(item => ({_id: item._id, type: item.content?.type, text: item.content?.text})))
    speechRecordList = speechRecordList
      .map(item => ({
        _id: item._id,
        day: item.day,
        stage: item.stage,
        type: item.content.type,
        text: item.content.text,
        source: item.content.source,
        audioBase64: item.content.audioBase64,
        audioMime: item.content.audioMime,
        audioDataUrl: item.content.audioDataUrl,
        playbackRequired: item.content.playbackRequired,
        playbackStatus: item.content.playbackStatus,
        from: item.content.from
      }))
    let speechTurnInfo = null
    if(gameInstance.stage === 5 || gameInstance.stage === 7){
      let speechTurnResult = await $service.gameService.getSpeechTurnState(gameInstance)
      if(speechTurnResult.result && speechTurnResult.data){
        speechTurnInfo = {
          currentSpeaker: speechTurnResult.data.currentSpeaker,
          currentIndex: speechTurnResult.data.currentIndex,
          total: speechTurnResult.data.order.length,
          order: speechTurnResult.data.order
        }
        if(
          speechTurnResult.data.currentSpeaker &&
          $service.aiService.isAiId(speechTurnResult.data.currentSpeaker.username)
        ){
          const pendingPlaybackResult = await $service.gameService.getPendingAiSpeechPlayback(gameInstance)
          if(!pendingPlaybackResult.result || !pendingPlaybackResult.data){
            setImmediate(async () => {
              try {
                const latestGame = await $service.baseService.queryById(game, gameInstance._id)
                await $service.aiService.runAiForStage(latestGame)
              } catch (e) {
                app.$log4.errorLogger.error('[gameController] trigger ai speech failed: ' + e.toString())
              }
            })
          }
        }
      }
    }
    let voteStageInfo = null
    if(gameInstance.stage === 6 || gameInstance.stage === 6.5){
      let voteStageResult = await $service.gameService.getVoteStageStatus(gameInstance)
      if(voteStageResult.result){
        voteStageInfo = voteStageResult.data
      }
    }
    const timerValue = $nodeCache.get('game-time-' + gameInstance._id)

    let gameInfo = {
      _id: gameInstance._id,
      roomId: gameInstance.roomId,
      status: gameInstance.status,
      day: gameInstance.day,
      stage: gameInstance.stage,
      stageName: stageMap[gameInstance.stage] ? stageMap[gameInstance.stage].name : '未知',
      dayTag: gameInstance.stage < 4 ? '晚上' : '白天',
      roleInfo: isOb ? {} : {
        role: currentPlayer.role,
        roleName: (playerRoleMap[currentPlayer.role] ? playerRoleMap[currentPlayer.role].name : ''),
        skill: currentPlayer.skill,
        username: currentPlayer.username,
        name: currentUser.name,
        position:currentPlayer.position,
        status: currentPlayer.status,
        camp: currentPlayer.camp
      },
      playerInfo: playerInfoResult.data,
      skill: skillInfo.data,
      broadcast: broadcastInfo.data,
      systemTip: systemTipsInfo.data,
      action: actionInfo.data,
      speechRecords: speechRecordList,
      speechTurn: speechTurnInfo,
      voteStage: voteStageInfo,
      timerTime: typeof timerValue === 'number' ? timerValue : 0,
      winner: gameInstance.winner,
      isOb: isOb
    }
    ctx.body = $helper.Result.success(gameInfo)
  },

  /**
   * @api {get} /api/game/nextStage/auth 房主推进下一阶段
   * @apiGroup 游戏模块
   */
  async nextStage (ctx) {
    const { $service, $helper, $model, $support, $nodeCache } = app
    const { game, player, action, room } = $model
    const { roomId, gameId, role } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }

    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'

    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameId, username: currentUser.username})
    if(!isOb && !currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中！')
      return
    }
    if(role){
      /** 去掉玩家调用这个接口，采用倒计时，到点系统自动跳转到下一阶段 **/
      // role存在，说明是非host用户在调用接口，逻辑和host调用一样的，只不过多校验一下身份
      if(role !== currentPlayer.role){
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过！')
        return
      }
      if(currentPlayer.role === 'predictor' && gameInstance.stage !== 1){
        // 是预言家身份在调用接口，但是游戏中不是预言家的回合
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过（不是你的回合）！')
        return
      }
      if(currentPlayer.role === 'wolf' && gameInstance.stage !== 2){
        // 是狼人身份在调用接口，但是游戏中不是狼人的回合
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过（不是你的回合）！')
        return
      }
      if(currentPlayer.role === 'witch' && gameInstance.stage !== 3){
        // 是女巫身份在调用接口，但是游戏中不是女巫的回合
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过（不是你的回合）！')
        return
      }
      if(currentPlayer.role === 'predictor'){
        let checkAction = await $service.baseService.queryOne(action, {
          roomId: roomId,
          gameId: gameId,
          day: gameInstance.day,
          stage: 1,
          from: currentPlayer.username,
          action: 'check'
        })
        if(!checkAction){
          ctx.body = $helper.Result.fail(-1,'预言家完成查验后才能进入下一阶段！')
          return
        }
      }
      if(currentPlayer.role === 'wolf'){
        let assaultAction = await $service.baseService.queryOne(action, {
          roomId: roomId,
          gameId: gameId,
          day: gameInstance.day,
          stage: 2,
          from: currentPlayer.username,
          action: 'assault'
        })
        if(!assaultAction){
          ctx.body = $helper.Result.fail(-1,'狼人完成刀人后才能进入下一阶段！')
          return
        }
      }
      if(currentPlayer.role === 'witch'){
        let saveAction = await $service.baseService.queryOne(action, {
          roomId: roomId,
          gameId: gameId,
          day: gameInstance.day,
          stage: 3,
          from: currentPlayer.username,
          action: 'antidote'
        })
        let poisonAction = await $service.baseService.queryOne(action, {
          roomId: roomId,
          gameId: gameId,
          day: gameInstance.day,
          stage: 3,
          from: currentPlayer.username,
          action: 'poison'
        })
        if(!saveAction && !poisonAction){
          ctx.body = $helper.Result.fail(-1,'女巫完成救人或毒人后才能进入下一阶段！')
          return
        }
      }
    } else {
      let roomInstance = await $service.baseService.queryById(room, roomId)
      if(!roomInstance){
        ctx.body = $helper.Result.fail(-1,'房间不存在！')
        return
      }
      if(roomInstance.owner !== currentUser.username){
        ctx.body = $helper.Result.fail(-1,'您不是该房间房主，无权进行此操作！')
        return
      }
    }
    if(gameInstance.status === 2){
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + $support.getGameWinner(gameInstance))
      return
    }
    if(gameInstance.status === 3){
      ctx.body = $helper.Result.fail(-1,'该局游戏已流局，请尝试重开游戏！')
      return
    }

    // 如果手动进入下一回合，需要清掉定时器
    if(app.$timer[gameInstance._id]){
      $nodeCache.set('game-time-' + gameInstance._id, -1)
      clearInterval(app.$timer[gameInstance._id])
    }
    await $helper.wait(200)

    let r = await $service.gameService.moveToNextStage(gameId)
    if(!r.result){
      ctx.body = $helper.Result.fail(r.errorCode, r.errorMessage)
      return
    }
    ctx.body = $helper.Result.success('操作成功！')
  },

  /**
   * @api {get} /api/game/record/auth 游戏记录
   * @apiGroup 游戏模块
   */
  async commonGameRecord (ctx) {
    const { $service, $helper, $model} = app
    const { game, record } = $model
    const { roomId, gameId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }

    let currentUser = await $service.baseService.userInfo(ctx)
    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'

    let query = {roomId: roomId, gameId: gameId}
    if(gameInstance.status === 1 && !isOb){
      query.isCommon = 1
    }

    let recordList = await $service.baseService.query(record, query, {} , {sort: {_id: -1}})
    recordList = (recordList || []).map(item => {
      if(item && typeof item.get === 'function'){
        return item.get({ plain: true })
      }
      if(item && typeof item.toJSON === 'function'){
        return item.toJSON()
      }
      return item
    })
    let tagMap = {}
    const iconvLite = require('iconv-lite')
    const mojibakeReplacements = [
      ['鎶曠エ', '投票'],
      ['寮冪エ', '弃票'],
      ['缁欎簡', '给了'],
      ['鍙风帺瀹讹紙', '号玩家（'],
      ['讹紙', '（'],
      ['锛屼', '，'],
      ['锛岀', '，'],
      ['锛屾', '，'],
      ['锛?', '，'],
      ['鐙间汉', '狼人'],
      ['绌哄垁', '空刀'],
      ['绌洪獙', '空验'],
      ['绌鸿繃', '空过'],
      ['鑽凡鐢ㄥ畬', '药已用完'],
      ['姣掕嵂', '毒药'],
      ['澶╀寒浜嗭紒', '天亮了！'],
      ['鏄ㄥぉ鏅氫笂鏄钩瀹夊!', '昨天晚上是平安夜！'],
      ['鏀鹃€愬嚭灞€', '放逐出局'],
      ['鎵€鏈変汉寮冪エ锛屾病鏈夌帺瀹跺嚭灞€', '所有人弃票，没有玩家出局'],
      ['骞崇エ', '平票'],
      ['鍔犺禌pk', '加赛pk'],
      ['杩涘叆', '进入'],
      ['杩涜pk', '进行pk'],
      ['姝ｅ悜', '正向'],
      ['閫嗗悜', '逆向'],
      ['鍑哄眬', '出局'],
      ['姝讳骸', '死亡'],
      ['琚嚮', '袭击']
    ]
    const mojibakePattern = /[杩涘叆鎶曠寮冩姝ｅ悜閫嗗悜鍙风帺瀹讹紙锛绁姣掕嵂鐙绌澶鏄鏀骞鍔琚]/
    const fixMojibake = (value) => {
      if(typeof value !== 'string'){
        return value
      }
      let replaced = value
      mojibakeReplacements.forEach(([from, to]) => {
        replaced = replaced.split(from).join(to)
      })
      if(replaced !== value){
        return replaced
      }
      if(!mojibakePattern.test(value)){
        return value
      }
      const fixed = iconvLite.encode(value, 'gbk').toString('utf8')
      return fixed && !fixed.includes('�') ? fixed : value
    }
    const normalizeRecordText = (value) => {
      if(Array.isArray(value)){
        return value.map(normalizeRecordText)
      }
      if(value && typeof value === 'object'){
        const next = {}
        Object.keys(value).forEach(key => {
          next[key] = normalizeRecordText(value[key])
        })
        return next
      }
      return fixMojibake(value)
    }

    // 游戏中只给部分信息，不影响游戏继续下去，隐藏掉关键的视野和角色信息
    // 游戏结束，给出完整游戏流程信息（属于复盘）
    const filterRecord = (record) => {

      const condition = (target, action) => {
        if(isOb){
          return false
        }
        if(action) {
          return gameInstance.status === 1 && target.role !== 'out' && target.role !== 'exile' && action !== 'shoot'
        } else {
          return gameInstance.status === 1 && target.role !== 'out' && target.role !== 'exile'
        }
      }

      record = normalizeRecordText(record)
      const content = record && record.content && typeof record.content === 'object' ? record.content : null
      if(!content || !content.type){
        return record
      }

      if(content.type === 'action'){
        const from = content.from || {}
        const to = content.to || {}
        return Object.assign({},record,{
          content: {
            type: content.type,
            text: content.text,
            level: content.level,
            action: content.action,
            actionName: content.actionName,
            from: {
              username: from.username,
              name: from.name,
              position: from.position,
              status: from.status,
              role: condition(from, content.action) ? null : from.role,
              camp: condition(from, content.action) ? null : from.camp
            },
            to: {
              username: to.username,
              name: to.name,
              position: to.position,
              status: to.status,
              role: condition(to, content.action) ? null : to.role,
              camp: condition(to, content.action) ? null : to.camp
            }
          }
        })
      }
      return record
    }

    recordList = recordList.map(filterRecord).reverse()
    tagMap = {}
    recordList.forEach(item => {
      const day = item.day || 1
      const key = 'day' + day
      if(!tagMap[key]){
        tagMap[key] = {
          key,
          content: []
        }
      }
      tagMap[key].content.push(item)
    })
    const voteCount = recordList.filter(item => item.content && item.content.type === 'vote').length
    console.log('[gameRecord] response', {
      roomId,
      gameId,
      day: gameInstance.day,
      stage: gameInstance.stage,
      recordCount: recordList.length,
      voteCount,
      keys: Object.keys(tagMap)
    })
    ctx.body = $helper.Result.success(tagMap)
  },

  /**
   * @api {get} /api/game/checkPlayer/auth 预言家查验
   * @apiGroup 游戏模块
   */
  async checkPlayer (ctx) {
    const { $service, $helper, $model, $ws, $constants } = app
    const { game, player, action, vision, record } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'predictor'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是预言家，无法使用该技能！')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }
    let visionInstance = await $service.baseService.queryOne(vision, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, to: username})
    if(visionInstance.status === 1){
      ctx.body = $helper.Result.fail(-1,'您已查验过该玩家的身份！')
      return
    }

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 1, action: 'check'})
    if(exist){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过查验功能！')
      return
    }
    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(targetPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'该玩家已出局！')
      return
    }
    // 修改视野
    await $service.baseService.updateById(vision, visionInstance._id, {status: 1})

    // 生成一条action
    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'check',
    }
    await $service.baseService.save(action, actionObject)

    let targetCamp = targetPlayer.camp
    let targetCampName = targetCamp === 1 ? '好人阵营' : '狼人阵营'
    // 生成一条record
    let recordObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 0,
      isTitle: 0,
      content: {
        type: 'action',
        text: '预言家：' + currentPlayer.position + '号玩家（' + currentPlayer.name + '）查验了' + targetPlayer.position + '号玩家（' + targetPlayer.name + '）的身份为：' + targetCampName,
        key: 'check',
        actionName: '查验',
        level: 3,
        from: {
          username: currentPlayer.username,
          name: currentPlayer.name,
          position: currentPlayer.position,
          role: currentPlayer.role,
          camp: currentPlayer.camp
        },
        to: {
          username: targetPlayer.username,
          name: targetPlayer.name,
          position: targetPlayer.position,
          role: targetPlayer.role,
          camp: targetPlayer.camp
        }
      }
    }
    await $service.baseService.save(record, recordObject)

    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
      camp: targetCamp,
      campName: targetCampName,
    }

    if($ws && $ws.connections){
      $ws.connections.forEach(function (conn) {
        let url = '/lrs/' + gameInstance.roomId
        if(conn.path === url){
          conn.sendText('refreshGame')
        }
      })
    }

    ctx.body = $helper.Result.success(r)
  },

  /**
   * @api {get} /api/game/assaultPlayer/auth 狼人袭击
   * @apiGroup 游戏模块
   */
  async assaultPlayer (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { game, player, action } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'wolf'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是狼人，无法使用该技能！')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 2, action: 'assault'})
    if(exist){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过袭击功能！')
      return
    }
    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(targetPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'该玩家已出局！')
      return
    }
    // 袭击不一定会真的造成死亡，还有可能被女巫救，所以要在天亮时结算。

    // 生成一条action
    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'assault',
    }
    await $service.baseService.save(action, actionObject)

    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
    }
    ctx.body = $helper.Result.success(r)
  },

  /**
   * @api {get} /api/game/antidotePlayer/auth 女巫解药
   * @apiGroup 游戏模块
   */
  async antidotePlayer (ctx) {
    const { $service, $helper, $model, $support } = app
    const { game, player, record, action } = $model
    const { roomId, gameId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'witch'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是女巫，无法使用该技能！')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }

    let skills = currentPlayer.skill
    let antidoteSkill
    skills.forEach(item=>{
      if(item.key === 'antidote'){
        antidoteSkill = item
      }
    })
    if(!antidoteSkill || antidoteSkill.status === 0){
      ctx.body = $helper.Result.fail(-1,'您当前状态不能使用该技能')
      return
    }

    let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: roomId, day: gameInstance.day, stage: 2, action: 'kill'})
    if(!killAction){
      ctx.body = $helper.Result.fail(-1,'当天没有玩家死亡，无需使用解药！')
      return
    }

    let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'antidote'})
    let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'poison'})
    if(saveAction || poisonAction){
      ctx.body = $helper.Result.fail(-1,'您已使用过该技能（解药）！')
      return
    }

    let killTarget = killAction.to
    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: killTarget,
      action: 'antidote',
    }
    await $service.baseService.save(action, actionObject)
    let diePlayer = await $service.baseService.queryOne(player,{roomId: roomId, gameId: gameInstance._id, username: killTarget})
    let recordObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 0,
      isTitle: 0,
      content: {
        type: 'action',
        key: 'antidote',
        text: '女巫——' + $support.getPlayerFullName(currentPlayer) + '使用解药救了：' +   $support.getPlayerFullName(diePlayer),
        actionName: '解药',
        level: 3,
        from: {
          username: currentPlayer.username,
          name: currentPlayer.name,
          position: currentPlayer.position,
          role: currentPlayer.role,
          camp: currentPlayer.camp
        },
        to: {
          username: diePlayer.username,
          name: diePlayer.name,
          position: diePlayer.position,
          role: diePlayer.role,
          camp: diePlayer.camp
        }
      },
    }
    await $service.baseService.save(record, recordObject)

    // 修改解药状态
    let newSkillStatus = []
    skills.forEach(item=>{
      if(item.key === 'antidote'){
        newSkillStatus.push({
          name: item.name,
          key: item.key,
          status: 0
        })
      } else {
        newSkillStatus.push(item)
      }
    })
    await $service.baseService.updateById(player, currentPlayer._id, {
      skill: newSkillStatus
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * @api {get} /api/game/votePlayer/auth 投票
   * @apiGroup 游戏模块
   */
  async votePlayer (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { game, player, action } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }

    if(gameInstance.stage !== 6 && gameInstance.stage !== 6.5) {
      ctx.body = $helper.Result.fail(-1,'该阶段不能进行投票操作')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 6, action: 'vote'})
    if(exist && gameInstance.stage === 6){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过投票功能！')
      return
    }
    if(gameInstance.flatTicket === 2){
      // 平票pk多出来的阶段
      let pkExist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 6.5, action: 'vote'})
      if(pkExist && gameInstance.stage === 6.5){
        ctx.body = $helper.Result.fail(-1,'今天你已使用过投票功能！')
        return
      }
    }

    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(!targetPlayer || targetPlayer.status !== 1){
      ctx.body = $helper.Result.fail(-1,'投票目标不存在或已出局！')
      return
    }
    if(gameInstance.stage === 6.5 && gameInstance.flatTicket === 2){
      const pkTag = await $service.baseService.queryOne($model.gameTag, {
        roomId: roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        mode: 3,
        desc: 'pkPlayer'
      })
      const pkPlayers = pkTag && Array.isArray(pkTag.value2) ? pkTag.value2 : []
      if(pkPlayers.includes(currentPlayer.username)){
        ctx.body = $helper.Result.fail(-1,'PK玩家不能参与本轮PK投票！')
        return
      }
      if(!pkPlayers.includes(targetPlayer.username)){
        ctx.body = $helper.Result.fail(-1,'PK阶段只能投票给PK候选玩家！')
        return
      }
    }

    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'vote',
    }
    await $service.baseService.save(action, actionObject)
    
    // 向AI服务发送投票事件（使用广播接口）
    try {
      const voteEvent = {
        day: gameInstance.day,
        stage: gameInstance.stage,
        eventType: 'vote',
        speaker: currentPlayer.username,
        content: `投票给 ${targetPlayer.name}(${targetPlayer.position}号)`,
        weight: 1.0,
        targets: [targetPlayer.username]
      }
      
      // 获取所有存活玩家作为候选目标
      const alivePlayers = await $service.baseService.query(player, {
        roomId: roomId,
        gameId: gameInstance._id,
        status: 1
      })
      const candidateTargets = alivePlayers.map(p => p.username)
      
      // 获取所有AI玩家
      const aiPlayers = alivePlayers.filter(p => p.username.startsWith('ai_'))
      const aiIds = aiPlayers.map(p => p.username)
      
      if(aiIds.length > 0){
        const axios = require('axios')
        const getBaseUrl = () => {
          return process.env.AI_SERVICE_BASE_URL ||
            (app.$config.aiService && app.$config.aiService.baseUrl) ||
            'http://127.0.0.1:8001'
        }

        await axios({
          method: 'post',
          url: getBaseUrl() + '/internal/ai/game/events/broadcast',
          data: {
            gameId: String(gameInstance._id),
            event: voteEvent,
            aiIds: aiIds,
            candidateTargets: candidateTargets,
            asyncMode: true
          },
          timeout: 12000,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      }
    } catch (error) {
      // AI服务调用失败不影响投票功能，只记录日志
      if(app.$log4 && app.$log4.errorLogger){
        app.$log4.errorLogger.error('[AI Service] 发送投票事件失败: ' + error.toString())
      }
    }
    
    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
    }
    const voteStatusResult = await $service.gameService.getVoteStageStatus(gameInstance)
    const autoAdvanceResult = await $service.gameService.tryAutoAdvanceVoteStage(gameInstance)
    ctx.body = $helper.Result.success(Object.assign({}, r, {
      voteStatus: voteStatusResult.result ? voteStatusResult.data : null,
      autoAdvanced: autoAdvanceResult.result && autoAdvanceResult.data ? !!autoAdvanceResult.data.advanced : false
    }))
    
    // 发送投票更新通知
    if($ws && $ws.connections){
      $ws.connections.forEach(function (conn) {
        let url = '/lrs/' + roomId
        if(conn.path === url){
          conn.sendText('refreshGame')
        }
      })
    }
  },

  /**
   * @api {get} /api/game/poisonPlayer/auth 女巫毒药
   * @apiGroup 游戏模块
   */
  async poisonPlayer (ctx) {
    const { $service, $helper, $model } = app
    const { game, player, action } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    if(gameInstance.stage !== 3) {
      ctx.body = $helper.Result.fail(-1,'该阶段不能进行毒药操作')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'witch'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是女巫，无法使用该技能！')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 3, action: 'poison'})
    if(exist){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过毒药功能！')
      return
    }
    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(targetPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'该玩家已出局！')
      return
    }

    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'poison',
    }
    await $service.baseService.save(action, actionObject)
    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
    }
    //修改毒药状态
    let newSkillStatus = []
    let skills = currentPlayer.skill
    skills.forEach(item=>{
      if(item.key === 'poison'){
        newSkillStatus.push({
          name: item.name,
          key: item.key,
          status: 0
        })
      } else {
        newSkillStatus.push(item)
      }
    })
    await $service.baseService.updateById(player, currentPlayer._id, {
      skill: newSkillStatus
    })
    ctx.body = $helper.Result.success(r)
  },

  /**
   * @api {get} /api/game/shootPlayer/auth 猎人开枪
   * @apiGroup 游戏模块
   */
  async shootPlayer (ctx) {
    const { $service, $helper, $model, $support, $ws } = app
    const { game, player, action, gameTag, record } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    if(gameInstance.stage !== 4 && gameInstance.stage !== 7) {
      ctx.body = $helper.Result.fail(-1,'该阶段不能进行开枪操作')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: {"$in": [4,7]}, action: 'shoot'})
    if(exist){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过开枪功能！')
      return
    }
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'hunter'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是猎人，无法使用该技能！')
      return
    }

    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(targetPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'该玩家已出局！')
      return
    }

    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'shoot',
    }
    await $service.baseService.save(action, actionObject)

    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
    }

    let recordObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 1,
      isTitle: 0,
      content: {
        type:'action',
        text: '猎人——' + $support.getPlayerFullName(currentPlayer) + '发动技能，开枪带走了'  + $support.getPlayerFullName(targetPlayer),
        action: 'shoot',
        actionName: '开枪',
        level: 2,
        from: {
          username: currentPlayer.username,
          name: currentPlayer.name,
          position: currentPlayer.position,
          role: currentPlayer.role,
          camp: currentPlayer.camp
        },
        to: {
          username: targetPlayer.username,
          name: targetPlayer.name,
          position: targetPlayer.position,
          role: targetPlayer.role,
          camp: targetPlayer.camp
        }
      }
    }
    await $service.baseService.save(record, recordObject)

    // 注册另一个玩家死亡
    let tagObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      dayStatus: gameInstance.stage < 4 ? 1 : 2,
      desc: 'shoot',
      mode: 1,
      target: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position
    }
    await $service.baseService.save(gameTag, tagObject)

    let deadRecord = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 1,
      isTitle: 0,
      content: {
        type: 'action',
        action: 'die',
        actionName: '死亡',
        level: 2,
        from: {
          username: targetPlayer.username,
          name: targetPlayer.name,
          position: targetPlayer.position,
          role: targetPlayer.role,
          camp: targetPlayer.camp
        },
        to: {
          role: 'out',
          name: '出局'
        }
      }
    }
    await $service.baseService.save(record, deadRecord)
    await $service.baseService.updateById(player, targetPlayer._id,{status: 0, outReason: 'shoot'})
    await $service.gameService.settleGameOver(gameInstance._id)

    let newSkillStatus = []
    let skills = currentPlayer.skill
    skills.forEach(item=>{
      if(item.key === 'shoot'){
        newSkillStatus.push({
          name: item.name,
          key: item.key,
          status: 0
        })
      } else {
        newSkillStatus.push(item)
      }
    })
    await $service.baseService.updateById(player, currentPlayer._id, {
      skill: newSkillStatus
    })

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
    ctx.body = $helper.Result.success(r)
  },

  /**
   * @api {get} /api/game/boomPlayer/auth 狼人自爆
   * @apiGroup 游戏模块
   */
  async boomPlayer (ctx) {
    const { $service, $helper, $model, $support, $ws } = app
    const { game, player, action, gameTag, record } = $model
    const { roomId, gameId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    // 只能在白天发言阶段自爆
    if(gameInstance.stage !== 5 ) {
      ctx.body = $helper.Result.fail(-1,'该阶段不能进行自爆操作')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'wolf'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是狼人，不能使用自爆技能！')
      return
    }

    // ✅ 修复1：记录自爆动作（修正stage错误）
    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage, // 这里原来写错成 currentPlayer.stage，必出bug
      from: currentPlayer.username,
      to: currentPlayer.username,
      action: 'boom',
    }
    await $service.baseService.save(action, actionObject)

    let recordObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 1,
      isTitle: 0,
      content: {
        type: 'action',
        text: $support.getPlayerFullName(currentPlayer) + '自爆！',
        action: 'boom',
        actionName: '自爆',
        level: 2,
        from: {
          username: currentPlayer.username,
          name: currentPlayer.name,
          position: currentPlayer.position,
          role: currentPlayer.role,
          camp: currentPlayer.camp
        },
        to: {
          name: '自爆',
          role: 'boom'
        }
      }
    }
    await $service.baseService.save(record, recordObject)
    
    // 注册死亡
    let tagObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      dayStatus: gameInstance.stage < 4 ? 1 : 2,
      desc: 'boom',
      mode: 1,
      target: currentPlayer.username,
      name: currentPlayer.name,
      position: currentPlayer.position
    }
    await $service.baseService.save(gameTag, tagObject)
    await $service.baseService.updateById(player, currentPlayer._id,{status: 0, outReason: 'boom'})
    
    let gameResult = await $service.gameService.settleGameOver(gameInstance._id)
    if(gameResult.result && gameResult.data === 'N'){
      // 清空当天投票动作，避免自爆后遗留投票数据影响后续阶段
      await $service.baseService.delete(action, {
        gameId: gameInstance._id,
        roomId: gameInstance.roomId,
        day: gameInstance.day,
        action: 'vote'
      })

      // 自爆后直接进入下一晚
      let updateGame = {
        stage: 0,
        day: gameInstance.day + 1,
      }
      await $service.baseService.updateById(game, gameInstance._id, updateGame)

      // 天黑提示
      let recordObjectNight = {
        roomId: roomId,
        gameId: gameInstance._id,
        day: gameInstance.day + 1,
        stage: 0,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          text: '天黑请闭眼。',
          type: 'text',
          level: 1
        }
      }
      await $service.baseService.save(record, recordObjectNight)
    }

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
    ctx.body = $helper.Result.success(true)
  },

  /**
   * @api {get} /api/game/result/auth 游戏结果
   * @apiGroup 游戏模块
   */
  async gameResult (ctx) {
    const { $service, $helper, $model} = app
    const { game} = $model
    const { id } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status !== 2){
      ctx.body = $helper.Result.fail(-1,'游戏还在进行中或游戏异常！')
      return
    }
    let result = {
      winner: gameInstance.winner,
      winnerString:  gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
    }
    ctx.body = $helper.Result.success(result)
  },

  /**
   * @api {get} /api/game/destroy/auth 销毁游戏
   * @apiGroup 游戏模块
   */
  async gameDestroy (ctx) {
    const { $service, $helper, $model, $ws, $nodeCache } = app
    const { game, record, room } = $model
    const { roomId, gameId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, roomId)
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    if(roomInstance.owner !== currentUser.username){
      ctx.body = $helper.Result.fail(-1,'只有该房间房主才能结束游戏')
      return
    }
    let update = {status: 3}
    await $service.baseService.updateById(game, gameInstance._id, update)

    let gameRecord = {
      roomId: roomInstance._id,
      gameId: gameInstance._id,
      content: '房主结束了该场游戏，游戏已结束！',
      isCommon: 1,
      isTitle: 0
    }
    await $service.baseService.save(record, gameRecord)

    if(app.$timer[gameInstance._id]){
      $nodeCache.set('game-time-' + gameInstance._id, -1)
      clearInterval(app.$timer[gameInstance._id])
      let data = {
        'refreshGame': false,
        time: 0,
      }
      $ws.connections.forEach(function (conn) {
        let url = '/lrs/' + gameInstance.roomId
        if(conn.path === url){
          conn.sendText(JSON.stringify(data))
        }
      })
    }

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * @api {get} /api/game/again/auth 再来一局
   * @apiGroup 游戏模块
   */
  async gameAgain (ctx) {
    const { $service, $helper, $model, $ws, $constants } = app
    const { room } = $model
    const { roomId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, roomId)
    if(!roomInstance){
      ctx.body = $helper.Result.fail(-1,'房间不存在！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    if(roomInstance.owner !== currentUser.username){
      ctx.body = $helper.Result.fail(-1,'只有该房间房主才能再开一局！')
      return
    }

    // 重置掉当前局, 就是简单的清掉gameId即可
    let update = {
      status: 0,
      gameId: null
    }
    const roomData = roomInstance.toJSON ? roomInstance.toJSON() : roomInstance
    const maxSeatCount = $constants.maxSeatCount || 12
    for(let i = 1; i <= maxSeatCount; i++){
      const seatUser = roomData['v' + i]
      if(seatUser && $service.aiService.isAiId(seatUser)){
        update['v' + i] = null
      }
    }
    await $service.baseService.updateById(room, roomInstance._id, update)
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + roomInstance._id
      if(conn.path === url){
        conn.sendText('reStart')
      }
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * @api {get} /api/game/ob/auth 观战
   * @apiGroup 游戏模块
   */
  async obGame (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { room, game, player } = $model
    const { key } = ctx.query
    if(!key || key === ''){
      ctx.body = $helper.Result.fail(-1,'房间密码不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryOne(room,{password: key}, {} ,{sort: { createTime: -1 }})
    if(!roomInstance){
      ctx.body = $helper.Result.fail(-1,'房间不存在或密码不对！')
      return
    }
    if(!roomInstance.gameId){
      ctx.body = $helper.Result.fail(-1,'游戏尚未开始！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, roomInstance.gameId)
    if(gameInstance.status !== 1){
      ctx.body = $helper.Result.fail(-1,'游戏未开始或已结束，无法观战！')
      return
    }

    // todo: 架构问题，导致上下文只能通过函数传值，非常不友好，可以参考eggjs架构，用class以及懒加载实现动态获取上下文。
    let currentUser = await $service.baseService.userInfo(ctx)
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomInstance._id, gameId: roomInstance.gameId, username: currentUser.username})
    if(currentPlayer){
      ctx.body = $helper.Result.fail(-1,'你正在该局游戏中，不能进入观战模式')
      return
    }

    let obList = roomInstance.ob
    if(typeof obList === 'string'){
      try {
        obList = JSON.parse(obList)
      } catch (e) {
        obList = []
      }
    }
    if(!Array.isArray(obList)){
      obList = []
    }
    if(obList.includes(currentUser.username)){
      ctx.body = $helper.Result.success(roomInstance._id)
      return
    }
    await $service.baseService.updateById(room, roomInstance._id, {
      ob: [...obList, currentUser.username]
    })

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + roomInstance._id
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
    ctx.body = $helper.Result.success(roomInstance._id)
  },

  /**
   * @api {post} /api/game/replay/auth 游戏复盘分析
   * @apiGroup 游戏模块
   */
  async replayGame (ctx) {
    const { $service, $helper, $model } = app
    const { game } = $model
    const body = ctx.request.body || {}
    const { gameId, enableAI, aiModel, outputDir, desensitize, force } = body

    console.log('[ReplayAPI] request received, gameId=' + gameId + ', enableAI=' + enableAI + ', force=' + force)

    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1, 'gameId不能为空！')
      return
    }

    try {
      // 获取游戏实例
      let gameInstance = await $service.baseService.queryById(game, gameId)
      if(!gameInstance){
        ctx.body = $helper.Result.fail(-1, '游戏不存在！')
        return
      }

      // 检查游戏是否已结束
      if(gameInstance.status !== 2){
        ctx.body = $helper.Result.fail(-1, '游戏尚未结束，无法进行复盘分析！')
        return
      }

      // 调用复盘服务
      const options = {
        enableAI: enableAI !== false,
        aiModel: aiModel,
        outputDir: outputDir || 'replay_analysis',
        desensitize: desensitize !== false,
        force: force === true
      }

      console.log('[ReplayAPI] start analyzeGame, gameId=' + gameId)
      const result = await $service.replayService.analyzeGame(gameInstance, options)
      console.log('[ReplayAPI] analyzeGame finished, gameId=' + gameId + ', success=' + result.result)

      if(!result.result){
        ctx.body = $helper.Result.fail(result.errorCode || -1, result.errorMessage || '复盘分析失败')
        return
      }

      // 修复响应格式：将result转换为data.analysis_files，匹配前端期望
      ctx.body = $helper.Result.success({
        gameId: gameId,
        analysisFiles: result.data.analysis_files, // 转换字段名
        gameRecord: result.data.game_record,
        timestamp: result.data.timestamp
      })

    } catch (error) {
      if(app.$log4 && app.$log4.errorLogger){
        app.$log4.errorLogger.error('[replayGame] 复盘分析失败: ' + error.toString())
      }
      ctx.body = $helper.Result.fail(-1, '复盘分析失败: ' + error.message)
    }
  },

  /**
   * @api {get} /api/game/replay/player/history/auth 查询玩家历史复盘列表
   * @apiGroup 游戏模块
   */
  async getPlayerReplayHistory (ctx) {
    const { $service, $helper, $model, $constants } = app
    const { game, player } = $model
    const { playerRoleMap } = $constants
    const { username, limit, page } = ctx.query

    try {
      const currentUser = await $service.baseService.userInfo(ctx)
      const targetUsername = username || currentUser.username
      const pageSize = Math.min(Math.max(parseInt(limit || 20), 1), 50)
      const pageNo = Math.max(parseInt(page || 1), 1)

      console.log('\n[ReplayHistory] request')
      console.log('[ReplayHistory] currentUser=' + currentUser.username + ', targetUsername=' + targetUsername + ', page=' + pageNo + ', limit=' + pageSize)

      const joinedPlayers = await $service.baseService.query(player, {
        username: targetUsername
      }, {}, { sort: { gameId: -1 } })

      if(!joinedPlayers || joinedPlayers.length < 1){
        console.log('[ReplayHistory] no joined games found for username=' + targetUsername)
        ctx.body = $helper.Result.success({
          username: targetUsername,
          total: 0,
          page: pageNo,
          limit: pageSize,
          list: []
        })
        return
      }

      const replayIndex = $service.replayService.readReplayIndex()
      const replayIndexMap = {}
      replayIndex.forEach(item => {
        replayIndexMap[String(item.gameId)] = item
      })
      console.log('[ReplayHistory] joinedPlayerRows=' + joinedPlayers.length + ', replayIndexRows=' + replayIndex.length)

      const rows = []
      for(let i = 0; i < joinedPlayers.length; i++){
        const p = joinedPlayers[i]
        const gameInstance = await $service.baseService.queryById(game, p.gameId)
        if(!gameInstance || gameInstance.status !== 2){
          continue
        }

        const indexItem = replayIndexMap[String(gameInstance._id)]
        const winnerLabel = gameInstance.winner === 1 ? '好人阵营' : gameInstance.winner === 0 ? '狼人阵营' : '未知'
        const roleInfo = playerRoleMap[p.role] || {}
        rows.push({
          gameId: gameInstance._id,
          roomId: gameInstance.roomId,
          playerCount: gameInstance.playerCount,
          mode: gameInstance.mode,
          days: gameInstance.day,
          winner: gameInstance.winner,
          winnerLabel,
          isWin: p.camp === gameInstance.winner,
          player: {
            username: p.username,
            name: p.name,
            position: p.position,
            role: p.role,
            roleName: roleInfo.name || p.roleName || p.role,
            camp: p.camp,
            status: p.status,
            outReason: p.outReason || null
          },
          hasReplay: !!indexItem,
          replayFiles: indexItem ? indexItem.analysisFiles : null,
          replayTimestamp: indexItem ? indexItem.timestamp : null,
          startTime: indexItem ? indexItem.startTime : gameInstance.createTime,
          endTime: indexItem ? indexItem.endTime : gameInstance.modifyTime
        })
      }

      rows.sort((a, b) => new Date(b.endTime || 0) - new Date(a.endTime || 0))
      const total = rows.length
      const start = (pageNo - 1) * pageSize
      const list = rows.slice(start, start + pageSize)
      console.log('[ReplayHistory] success username=' + targetUsername + ', finishedGames=' + total + ', returned=' + list.length + ', withReplay=' + rows.filter(item => item.hasReplay).length)

      ctx.body = $helper.Result.success({
        username: targetUsername,
        total,
        page: pageNo,
        limit: pageSize,
        list
      })
    } catch (error) {
      if(app.$log4 && app.$log4.errorLogger){
        app.$log4.errorLogger.error('[getPlayerReplayHistory] 查询玩家历史复盘失败: ' + error.toString())
      }
      ctx.body = $helper.Result.fail(-1, '查询玩家历史复盘失败: ' + error.message)
    }
  },

  /**
   * @api {get} /api/game/replay/detail/auth 查询单局复盘详情
   * @apiGroup 游戏模块
   */
  async getReplayDetail (ctx) {
    const { $service, $helper, $model } = app
    const { game, player } = $model
    const { gameId } = ctx.query

    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1, 'gameId不能为空！')
      return
    }

    try {
      const currentUser = await $service.baseService.userInfo(ctx)
      console.log('\n[ReplayDetail] request')
      console.log('[ReplayDetail] currentUser=' + currentUser.username + ', gameId=' + gameId)
      const gameInstance = await $service.baseService.queryById(game, gameId)
      if(!gameInstance){
        console.log('[ReplayDetail] failed: game not found, gameId=' + gameId)
        ctx.body = $helper.Result.fail(-1, '游戏不存在！')
        return
      }

      const currentPlayer = await $service.baseService.queryOne(player, {
        gameId: gameInstance._id,
        roomId: gameInstance.roomId,
        username: currentUser.username
      })
      const obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
      const isOb = obResult.result && obResult.data === 'Y'
      if(!currentPlayer && !isOb){
        console.log('[ReplayDetail] denied: current user is not player or observer, gameId=' + gameId)
        ctx.body = $helper.Result.fail(-1, '未查询到你在该游戏中，无法查看复盘详情！')
        return
      }

      const indexItem = $service.replayService.getReplayIndexByGameId(gameInstance._id)
      if(!indexItem){
        console.log('[ReplayDetail] failed: replay index not found, gameId=' + gameId)
        ctx.body = $helper.Result.fail(-1, '该局还没有生成复盘，请先调用复盘分析接口！')
        return
      }

      const analysisContent = $service.replayService.getReplayAnalysisContent(indexItem.analysisFiles)
      const gameRecord = await $service.replayService.generateGameRecord(gameInstance)
      console.log('[ReplayDetail] success gameId=' + gameId + ', hasJson=' + !!analysisContent.json + ', hasText=' + !!analysisContent.text)
      ctx.body = $helper.Result.success({
        ...indexItem,
        gameRecord,
        analysis: analysisContent
      })
    } catch (error) {
      if(app.$log4 && app.$log4.errorLogger){
        app.$log4.errorLogger.error('[getReplayDetail] 查询复盘详情失败: ' + error.toString())
      }
      ctx.body = $helper.Result.fail(-1, '查询复盘详情失败: ' + error.message)
    }
  },

  /**
   * @api {get} /api/game/replay/file 读取复盘文件内容
   * @apiGroup 游戏模块
   */
  async getReplayFile (ctx) {
    const { $helper } = app
    const { query } = ctx
    const { file } = query

    if(!file || file === ''){
      ctx.body = $helper.Result.fail(-1, '文件路径不能为空！')
      return
    }

    try {
      const fs = require('fs')
      const path = require('path')
      
      
      // 安全检查：只允许读取replay_analysis目录下的文件
      const filePath = path.resolve(file)
      const allowedDir = path.resolve('replay_analysis')
      
      if(!filePath.startsWith(allowedDir)){
        ctx.body = $helper.Result.fail(-1, '文件路径不安全！')
        return
      }

      if(!fs.existsSync(filePath)){
        ctx.body = $helper.Result.fail(-1, '文件不存在！')
        return
      }

      const fileContent = fs.readFileSync(filePath, 'utf8')
      ctx.body = fileContent
    } catch (error) {
      ctx.body = $helper.Result.fail(-1, '读取文件失败: ' + error.message)
    }
  },

  /**
   * @api {get} /api/game/replay/health/auth 复盘服务健康检查
   * @apiGroup 游戏模块
   */
  async replayHealth (ctx) {
    const { $service, $helper } = app

    try {
      const result = await $service.replayService.checkHealth()
      
      if(!result.result){
        ctx.body = $helper.Result.fail(result.errorCode || -1, result.errorMessage || '复盘服务不可用')
        return
      }

      ctx.body = $helper.Result.success(result.data)
    } catch (error) {
      ctx.body = $helper.Result.fail(-1, '健康检查失败: ' + error.message)
    }
  },

  /**
   * @api {get} /api/game/wolfSuggestions 获取AI狼人建议
   * @apiGroup 游戏模块
   */
  async getWolfSuggestions(ctx) {
    const { $service, $helper, $model } = app
    const { game, player, record } = $model
    const { roomId, gameId } = ctx.query

    if(!roomId || !gameId){
      ctx.body = $helper.Result.fail(-1, '房间ID和游戏ID不能为空')
      return
    }

    try {
      // 验证用户是狼人
      const currentUser = await $service.baseService.userInfo(ctx)
      if(!currentUser){
        ctx.body = $helper.Result.fail(-1, '用户未登录')
        return
      }

      const gameInstance = await $service.baseService.queryById(game, gameId)
      if(!gameInstance){
        ctx.body = $helper.Result.fail(-1, '游戏不存在')
        return
      }

      const currentPlayer = await $service.baseService.queryOne(player, {
        roomId: roomId,
        gameId: gameId,
        username: currentUser.username
      })

      if(!currentPlayer || currentPlayer.role !== 'wolf' || currentPlayer.status !== 1){
        ctx.body = $helper.Result.fail(-1, '只有存活的狼人才能查看建议')
        return
      }

      const aliveAiWolf = await $service.baseService.queryOne(player, {
        roomId: roomId,
        gameId: gameId,
        role: 'wolf',
        status: 1,
        username: { $like: 'ai_%' }
      })

      if(!aliveAiWolf){
        ctx.body = $helper.Result.success({
          suggestions: [],
          day: gameInstance.day,
          stage: gameInstance.stage,
          hasAiWolf: false
        })
        return
      }

      // 获取当前轮次的AI建议
      const suggestions = await $service.baseService.query(record, {
        roomId: roomId,
        gameId: gameId,
        day: gameInstance.day,
        stage: gameInstance.stage,
        'content.type': 'wolf_advice'
      }, {}, { sort: { _id: -1 } })

      ctx.body = $helper.Result.success({
        suggestions: suggestions || [],
        day: gameInstance.day,
        stage: gameInstance.stage,
        hasAiWolf: true
      })
    } catch (error) {
      if(app.$log4 && app.$log4.errorLogger){
        app.$log4.errorLogger.error('[getWolfSuggestions] 获取狼人建议失败: ' + error.toString())
      }
      ctx.body = $helper.Result.fail(-1, '获取狼人建议失败: ' + error.message)
    }
  },

  /**
   * @api {get} /api/game/debug/roles 获取所有玩家角色信息（调试用）
   * @apiGroup 游戏模块
   */
  async getDebugRoles(ctx) {
    const { $service, $helper, $model } = app
    const { game, player } = $model
    const { roomId, gameId } = ctx.query

    if(!roomId || !gameId){
      ctx.body = $helper.Result.fail(-1, '房间ID和游戏ID不能为空')
      return
    }

    try {
      // 简化环境检查，允许在开发环境和生产环境（用于测试）
      const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local'
      
      // 生产环境需要特殊header才能访问
      if(!isDev && ctx.headers['x-debug-mode'] !== 'enabled'){
        ctx.body = $helper.Result.fail(-1, '调试接口只在开发环境下可用，生产环境需要X-Debug-Mode: enabled头')
        return
      }

      const gameInstance = await $service.baseService.queryById(game, gameId)
      if(!gameInstance){
        ctx.body = $helper.Result.fail(-1, '游戏不存在')
        return
      }

      // 获取所有玩家信息（包含角色）
      const allPlayers = await $service.baseService.query(player, {
        roomId: roomId,
        gameId: gameId
      }, {}, { sort: { position: 1 } })

      // 获取AI狼人建议
      const suggestions = await $service.baseService.query($model.record, {
        roomId: roomId,
        gameId: gameId,
        day: gameInstance.day,
        stage: gameInstance.stage,
        'content.type': 'wolf_advice'
      }, {}, { sort: { _id: -1 } })

      const playersWithRoles = allPlayers.map(player => ({
        username: player.username,
        name: player.name,
        position: player.position,
        role: player.role,
        status: player.status,
        isAI: player.username.startsWith('ai_'),
        isAlive: player.status === 1
      }))

      const wolfPlayers = playersWithRoles.filter(p => p.role === 'wolf')
      const humanWolves = wolfPlayers.filter(w => !w.isAI)
      const aiWolves = wolfPlayers.filter(w => w.isAI)

      ctx.body = $helper.Result.success({
        gameInfo: {
          gameId: gameInstance._id,
          roomId: gameInstance.roomId,
          day: gameInstance.day,
          stage: gameInstance.stage,
          status: gameInstance.status
        },
        players: playersWithRoles,
        wolfTeam: {
          total: wolfPlayers.length,
          humans: humanWolves,
          ai: aiWolves,
          hasHumanWolf: humanWolves.length > 0,
          decisionMode: humanWolves.length > 0 ? 'advice_only' : 'auto_execute'
        },
        aiSuggestions: suggestions || [],
        debugInfo: {
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      if(app.$log4 && app.$log4.errorLogger){
        app.$log4.errorLogger.error('[getDebugRoles] 获取调试信息失败: ' + error.toString())
      }
      ctx.body = $helper.Result.fail(-1, '获取调试信息失败: ' + error.message)
    }
  },

  /**
   * @api {post} /api/game/wolfVoiceChat/auth 狼人实时语音聊天
   * @apiGroup 游戏模块
   */
  async wolfVoiceChat(ctx) {
    const { $service, $helper, $ws } = app
    const { roomId, gameId, audioData, username } = ctx.request.body || {}

    if(!roomId || !gameId || !username){
      ctx.body = $helper.Result.fail(-1, '参数不完整')
      return
    }

    try {
      // 临时移除狼人权限验证，直接处理
      console.log('🔊 收到语音消息:', { roomId, gameId, username })
      
      // 实时广播给所有连接的客户端
      const wolfMessage = {
        type: 'wolfVoiceChat',
        roomId: roomId,
        gameId: gameId,
        sender: username,
        senderName: username, // 临时使用username
        audioData: audioData,
        timestamp: new Date().toISOString()
      }

      // 通过WebSocket实时推送
      $ws.connections.forEach(function (conn) {
        if(conn.roomId === roomId && conn.gameId === gameId){
          console.log('📡 发送语音消息给:', conn.userInfo?.username)
          conn.send(JSON.stringify(wolfMessage))
        }
      })

      ctx.body = $helper.Result.success({ message: '语音消息已发送' })

      // 通过WebSocket实时推送给所有狼人
      $ws.connections.forEach(function (conn) {
        if(conn.roomId === roomId && conn.gameId === gameId && conn.userInfo){
          // 检查接收者是否为狼人
          const receiver = conn.userInfo
          if(receiver.role === 'wolf'){
            conn.send(JSON.stringify(wolfMessage))
          }
        }
      })

      ctx.body = $helper.Result.success({ message: '语音消息已发送' })
    } catch (error) {
      ctx.body = $helper.Result.fail(-1, '发送语音消息失败: ' + error.message)
    }
  },

  /**
   * @api {post} /api/game/saveLastWords/auth 保存遗言
   * @apiGroup 游戏模块
   */
  async saveLastWords (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { room, game, user, player, record } = $model
    const { roomId, gameId, content, audioUrl, userInfo } = ctx.request.body || {}

    if(!roomId || !gameId || !content){
      ctx.body = $helper.Result.fail(-1, '参数不完整')
      return
    }

    try {
      console.log('💬 保存遗言:', { roomId, gameId, userInfo, content })
      const gameInstance = await $service.baseService.queryById(game, gameId)
      if(!gameInstance){
        ctx.body = $helper.Result.fail(-1, '游戏不存在')
        return
      }
      if(gameInstance.stage !== 7){
        ctx.body = $helper.Result.fail(-1, '当前不是遗言阶段，不能发表遗言')
        return
      }

      const currentUser = await $service.baseService.userInfo(ctx)
      const currentPlayer = await $service.baseService.queryOne(player, {
        roomId,
        gameId,
        username: currentUser.username
      })
      if(!currentPlayer){
        ctx.body = $helper.Result.fail(-1, '未查询到你在该游戏中')
        return
      }
      if(currentPlayer.status !== 0){
        ctx.body = $helper.Result.fail(-1, '只有出局玩家可以发表遗言')
        return
      }
      const voteDeathTag = await $service.baseService.queryOne($model.gameTag, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        desc: 'vote',
        mode: 1,
        target: currentPlayer.username
      })
      if(!voteDeathTag){
        ctx.body = $helper.Result.fail(-1, '只有被投票出局的玩家可以发表遗言')
        return
      }


      const turnResult = await $service.gameService.getSpeechTurnState(gameInstance)
      if(!turnResult.result){
        ctx.body = $helper.Result.fail(turnResult.errorCode, turnResult.errorMessage)
        return
      }
      const currentSpeaker = turnResult.data && turnResult.data.currentSpeaker
      if(!currentSpeaker || currentSpeaker.username !== currentPlayer.username){
        ctx.body = $helper.Result.fail(-1, '还没有轮到你发表遗言')
        return
      }

      // 保存遗言记录
      const lastWordsRecord = await $service.baseService.save(record, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [], // 公开可见
        isCommon: 1, // 公共记录
        isTitle: 0,
        content: {
          type: 'lastWords',
          source: 'player',
          text: content,
          audioUrl: audioUrl,
          from: {
            username: currentPlayer.username,
            name: currentPlayer.name,
            position: currentPlayer.position
          },
          timestamp: new Date().toISOString()
        }
      })
      const advanceResult = await $service.gameService.advanceSpeechTurn(gameInstance)

      // 通过WebSocket实时广播遗言
      const lastWordsMessage = {
        type: 'lastWords',
        roomId: roomId,
        gameId: gameId,
        content: content,
        audioUrl: audioUrl,
        player: userInfo,
        timestamp: new Date().toISOString()
      }

      $ws.connections.forEach(function (conn) {
        if(conn.roomId === roomId && conn.gameId === gameId){
          console.log('📡 发送遗言给:', conn.userInfo?.username)
          conn.send(JSON.stringify(lastWordsMessage))
        }
      })

      ctx.body = $helper.Result.success({ 
        message: '遗言保存成功',
        data: lastWordsRecord,
        nextSpeaker: advanceResult.result && advanceResult.data ? advanceResult.data.currentSpeaker : null,
        finished: advanceResult.result && advanceResult.data ? !!advanceResult.data.finished : false
      })
    } catch (error) {
      console.error('保存遗言失败:', error)
      ctx.body = $helper.Result.fail(-1, '保存遗言失败: ' + error.message)
    }
  }
})
