module.exports = app => ({

  /**
   * 获取可见的玩家信息
   * @returns {Promise<{result}>}
   */
  async getPlayerInfoInGame (ctx,id) {
    const { $service, $helper, $model, $constants } = app
    const { game, player, user, vision, gameTag } = $model
    const { playerRoleMap } = $constants
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let currentUser = await $service.baseService.userInfo(ctx)
    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'
    let currentPlayer = await $service.baseService.queryOne(player, {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      username: currentUser.username
    })
    if(currentPlayer){
      isOb = false
    }
    let playerCount = gameInstance.playerCount || 9
    let playerInfo = []

    let pkTag = await $service.baseService.queryOne(gameTag, {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      mode: 3,
      desc: 'pkPlayer'
    })
    let pkPlayer = pkTag ? pkTag.value2 : []
    const getTarget = (name) => {
      // 判断是否进入平票pk环节，该阶段处于非pk中玩家，不能被投票
      if(gameInstance.flatTicket !== 2){
        return true
      }

      if(gameInstance.flatTicket === 2 && gameInstance.stage === 6.5){
        return pkPlayer.includes(name)
      }
      return true
    }
    for(let i =0; i < playerCount; i++) {
      let un = gameInstance['v' + (i + 1)]
      // 查询其他玩家信息
      let otherPlayer = await $service.baseService.queryOne(player, {username: un, gameId: id, roomId: gameInstance.roomId})
      if(gameInstance.status === 2 || gameInstance.status === 3 || isOb){
        // 如果游戏已经结束，则获取完全视野（复盘）
        playerInfo.push({
          name: otherPlayer.name,
          username: otherPlayer.username,
          isSelf: un === currentUser.username, // 是否是自己
          camp: otherPlayer.camp, // 是否知晓阵营
          campName: otherPlayer.camp === 1 ? '好人阵营' : '狼人阵营', // 是否知晓阵营
          status: otherPlayer.status, // 是否死亡
          role: otherPlayer.role, // 是否知晓角色
          roleName: playerRoleMap[otherPlayer.role] ? playerRoleMap[otherPlayer.role].name : '', // 是否知晓角色
          position: otherPlayer.position,
          isTarget: getTarget(otherPlayer.username)
        })
        continue
      }
      // 查询玩家信息
      let otherUser = await $service.baseService.queryOne(user, {username: otherPlayer.username})
      // 查询自己对该玩家的视野
      let visionInstance = await $service.baseService.queryOne(vision, {gameId: gameInstance._id, roomId: gameInstance.roomId, from: currentUser.username, to: un})
      playerInfo.push({
        name: otherUser.name,
        username: otherUser.username,
        isSelf: un === currentUser.username, // 是否是自己
        camp: visionInstance.status === 0 ? null : otherPlayer.camp, // 是否知晓阵营
        campName: visionInstance.status === 0 ? null : (otherPlayer.camp === 1 ? '好人阵营' : '狼人阵营'),
        status: otherPlayer.status, // 是否死亡
        role: visionInstance.status === 2 ? otherPlayer.role : null, // 是否知晓角色
        roleName: visionInstance.status === 2 ? (playerRoleMap[otherPlayer.role] ? playerRoleMap[otherPlayer.role].name : '') : null,
        position: otherPlayer.position,
        isTarget: getTarget(otherPlayer.username)
      })
    }
    return $helper.wrapResult(true, playerInfo)
  },

  async getSpeechTurnState(gameInstance) {
    const { $service, $helper, $model } = app
    const { gameTag, player } = $model
    const stageNumber = Number(gameInstance && gameInstance.stage)
    const isFirstNightDeathSpeechStage = stageNumber === 4 && Number(gameInstance.day) === 1
    if(!gameInstance || (stageNumber !== 5 && stageNumber !== 7 && !isFirstNightDeathSpeechStage)){
      return $helper.wrapResult(true, null)
    }
    // 根据阶段选择不同的desc
    const desc = stageNumber === 7 ? 'lastWordsOrder' : isFirstNightDeathSpeechStage ? 'firstNightLastWordsOrder' : 'speakOrder'
    let orderTag = await $service.baseService.queryOne(gameTag, {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      desc: desc,
      mode: 2
    }, {}, { sort: { _id: -1 } })
    if(!orderTag){
      if(isFirstNightDeathSpeechStage){
        const deadTags = await $service.baseService.query(gameTag, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: 1,
          stage: { $in: [2, 3, 4] },
          mode: 1
        }, {}, { sort: { position: 1 } })
        const addedDead = {}
        const firstNightDeadSpeakers = []
        for(let i = 0; i < (deadTags || []).length; i++){
          const tag = deadTags[i]
          if(!tag.target || addedDead[tag.target]){
            continue
          }
          const deadPlayer = await $service.baseService.queryOne(player, {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            username: tag.target,
            status: 0
          })
          if(deadPlayer){
            firstNightDeadSpeakers.push({
              username: deadPlayer.username,
              name: deadPlayer.name,
              position: deadPlayer.position,
              isFirstNightLastWords: true
            })
            addedDead[tag.target] = true
          }
        }
        if(firstNightDeadSpeakers.length < 1){
          return $helper.wrapResult(true, {
            orderTag: null,
            order: [],
            currentIndex: 0,
            currentSpeaker: null,
            finished: true
          })
        }
        orderTag = await $service.baseService.save(gameTag, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: 4,
          dayStatus: 2,
          desc,
          mode: 2,
          value: 'asc',
          target: firstNightDeadSpeakers[0].username,
          name: firstNightDeadSpeakers[0].name,
          position: firstNightDeadSpeakers[0].position,
          value2: firstNightDeadSpeakers,
          value3: { currentIndex: 0 }
        })
      } else {
        return $helper.wrapResult(false, '发言顺序不存在', -1)
      }
    }
    let order = Array.isArray(orderTag.value2) ? orderTag.value2 : []
    if(order.length < 1){
      // 只有发言阶段需要自动生成发言顺序，遗言阶段不需要
      if (gameInstance.stage === 5) {
        let alivePlayers = await $service.baseService.query(player, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          status: 1
        }, {}, { sort: { position: 1 } })
        alivePlayers = alivePlayers || []
        const startIndex = Math.max(0, alivePlayers.findIndex(item => item.username === orderTag.target))
        const direction = String(orderTag.value || '').trim() === 'desc' ? -1 : 1
        for(let i = 0; i < alivePlayers.length; i++){
          const index = (startIndex + direction * i + alivePlayers.length) % alivePlayers.length
          const item = alivePlayers[index]
          order.push({
            username: item.username,
            name: item.name,
            position: item.position
          })
        }
        await $service.baseService.updateById(gameTag, orderTag._id, {
          value2: order,
          value3: { currentIndex: 0 }
        })
      }
    }
    const currentIndex = Number(orderTag.value3 && orderTag.value3.currentIndex !== undefined ? orderTag.value3.currentIndex : 0)
    return $helper.wrapResult(true, {
      orderTag,
      order,
      currentIndex,
      currentSpeaker: order[currentIndex] || null,
      finished: currentIndex >= order.length
    })
  },

  async advanceSpeechTurn(gameInstance, expectedUsername = null, expectedIndex = null) {
    const { $service, $helper, $model, $nodeCache } = app
    const { gameTag } = $model
    const lockKey = gameInstance ? ('speech-advance-lock-' + gameInstance._id + '-' + gameInstance.day + '-' + gameInstance.stage) : null
    if(lockKey && $nodeCache.get(lockKey)){
      const latestStateResult = await this.getSpeechTurnState(gameInstance)
      return $helper.wrapResult(true, Object.assign({}, latestStateResult.data || {}, { locked: true }))
    }
    if(lockKey){
      $nodeCache.set(lockKey, 1, 5)
    }
    try {
      const turnResult = await this.getSpeechTurnState(gameInstance)
      if(!turnResult.result){
        return turnResult
      }
      const state = turnResult.data
      if(!state || !state.orderTag){
        return $helper.wrapResult(true, { finished: true, currentSpeaker: null })
      }
      const currentSpeaker = state.currentSpeaker
      if(expectedIndex !== null && expectedIndex !== undefined && state.currentIndex !== Number(expectedIndex)){
        return $helper.wrapResult(true, {
          finished: state.finished,
          currentSpeaker,
          currentIndex: state.currentIndex,
          skipped: true,
          staleIndex: true
        })
      }
      if(expectedUsername && (!currentSpeaker || currentSpeaker.username !== expectedUsername)){
        return $helper.wrapResult(true, {
          finished: state.finished,
          currentSpeaker,
          currentIndex: state.currentIndex,
          skipped: true
        })
      }
      const nextIndex = state.currentIndex + 1
      await $service.baseService.updateById(gameTag, state.orderTag._id, {
        value3: { currentIndex: nextIndex }
      })
      return $helper.wrapResult(true, {
        finished: nextIndex >= state.order.length,
        currentSpeaker: state.order[nextIndex] || null,
        currentIndex: nextIndex
      })
    } finally {
      if(lockKey){
        $nodeCache.del(lockKey)
      }
    }
  },

  async getPendingAiSpeechPlayback(gameInstance) {
    const { $service, $helper, $model } = app
    const { record } = $model
    const stageNumber = Number(gameInstance && gameInstance.stage)
    const isFirstNightDeathSpeechStage = stageNumber === 4 && Number(gameInstance.day) === 1
    if(!gameInstance || (stageNumber !== 5 && stageNumber !== 7 && !isFirstNightDeathSpeechStage)){
      return $helper.wrapResult(true, null)
    }
    const records = await $service.baseService.query(record, {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage
    }, {}, { sort: { _id: -1 }, limit: 20 })
    const pending = (records || []).find(item => {
      const content = item.content || {}
      return content.source === 'ai' &&
        content.playbackRequired === true &&
        content.playbackStatus === 'pending' &&
        (content.type === 'speech' || content.type === 'lastWords')
    })
    return $helper.wrapResult(true, pending || null)
  },

  async completeAiSpeechPlayback(gameInstance, recordId) {
    const { $service, $helper, $model, $ws } = app
    const { record, game } = $model
    const stageNumber = Number(gameInstance && gameInstance.stage)
    const isFirstNightDeathSpeechStage = stageNumber === 4 && Number(gameInstance.day) === 1
    if(!gameInstance || (stageNumber !== 5 && stageNumber !== 7 && !isFirstNightDeathSpeechStage)){
      return $helper.wrapResult(false, '当前阶段不需要确认AI语音播放', -1)
    }
    const pendingResult = await this.getPendingAiSpeechPlayback(gameInstance)
    if(!pendingResult.result){
      return pendingResult
    }
    const pending = pendingResult.data
    if(!pending){
      return $helper.wrapResult(true, { finished: false, currentSpeaker: null, noPending: true })
    }
    if(recordId && String(pending._id) !== String(recordId)){
      return $helper.wrapResult(false, '确认的AI发言记录不是当前待播放记录', -1)
    }
    const content = Object.assign({}, pending.content || {}, {
      playbackStatus: 'played',
      playedAt: new Date().toISOString()
    })
    await $service.baseService.updateById(record, pending._id, { content })

    const pendingContent = pending.content || {}
    const pendingSpeaker = pendingContent.from && pendingContent.from.username ? pendingContent.from.username : null
    const advanceResult = await this.advanceSpeechTurn(gameInstance, pendingSpeaker, pendingContent.speechTurnIndex)
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })

    if(advanceResult.result && advanceResult.data){
      if(advanceResult.data.finished && Number(gameInstance.stage) !== 7){
        setImmediate(async () => {
          await $service.gameService.moveToNextStage(gameInstance._id)
        })
      } else if(advanceResult.data.currentSpeaker && $service.aiService.isAiId(advanceResult.data.currentSpeaker.username)){
        setImmediate(async () => {
          const latestGame = await $service.baseService.queryById(game, gameInstance._id)
          await $service.aiService.runAiForStage(latestGame)
        })
      }
    }
    return advanceResult
  },

  async getVoteStageStatus(gameInstance) {
    const { $service, $helper, $model } = app
    const { player, action, gameTag } = $model
    const stageNumber = gameInstance ? Number(gameInstance.stage) : null
    if(!gameInstance || (stageNumber !== 6 && stageNumber !== 6.5)){
      return $helper.wrapResult(true, null)
    }

    let alivePlayers = await $service.baseService.query(player, {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      status: 1
    }, {}, { sort: { position: 1 } })
    alivePlayers = alivePlayers || []

    let eligiblePlayers = alivePlayers
    if(stageNumber === 6.5 && gameInstance.flatTicket === 2){
      const pkTag = await $service.baseService.queryOne(gameTag, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        mode: 3,
        desc: 'pkPlayer'
      })
      const pkPlayers = pkTag && Array.isArray(pkTag.value2) ? pkTag.value2 : []
      eligiblePlayers = alivePlayers.filter(item => !pkPlayers.includes(item.username))
    }

    let voteActions = await $service.baseService.query(action, {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: stageNumber,
      action: 'vote'
    }, {}, { sort: { _id: 1 } })
    voteActions = voteActions || []
    const votedSet = {}
    voteActions.forEach(item => {
      if(item.from){
        votedSet[item.from] = true
      }
    })
    const eligibleUsernames = eligiblePlayers.map(item => item.username)
    const votedCount = eligibleUsernames.filter(username => votedSet[username]).length
    return $helper.wrapResult(true, {
      stage: stageNumber,
      total: eligibleUsernames.length,
      voted: votedCount,
      finished: eligibleUsernames.length > 0 && votedCount >= eligibleUsernames.length,
      eligiblePlayers: eligiblePlayers.map(item => ({
        username: item.username,
        name: item.name,
        position: item.position,
        hasVoted: !!votedSet[item.username]
      }))
    })
  },

  async tryAutoAdvanceVoteStage(gameInstance) {
    const { $service, $helper, $nodeCache } = app
    const stageNumber = gameInstance ? Number(gameInstance.stage) : null
    if(!gameInstance || (stageNumber !== 6 && stageNumber !== 6.5)){
      return $helper.wrapResult(true, { advanced: false })
    }
    const statusResult = await this.getVoteStageStatus(gameInstance)
    if(!statusResult.result){
      return statusResult
    }
    const status = statusResult.data
    if(!status || !status.finished){
      console.log('[tryAutoAdvanceVoteStage] vote not finished, skip auto advance', {
        gameId: gameInstance._id,
        roomId: gameInstance.roomId,
        day: gameInstance.day,
        stage: stageNumber,
        total: status && status.total,
        voted: status && status.voted
      })
      return $helper.wrapResult(true, { advanced: false, voteStatus: status })
    }
    const lockKey = 'vote-auto-advance-' + gameInstance._id + '-' + gameInstance.day + '-' + stageNumber
    if($nodeCache.get(lockKey)){
      return $helper.wrapResult(true, { advanced: false, locked: true, voteStatus: status })
    }
    $nodeCache.set(lockKey, 1, 10)
    if(app.$timer[gameInstance._id]){
      $nodeCache.set('game-time-' + gameInstance._id, -1)
      clearInterval(app.$timer[gameInstance._id])
      delete app.$timer[gameInstance._id]
    }
    console.log('[tryAutoAdvanceVoteStage] vote finished, auto advance', {
      gameId: gameInstance._id,
      roomId: gameInstance.roomId,
      day: gameInstance.day,
      stage: stageNumber,
      total: status.total,
      voted: status.voted
    })
    const moveResult = await $service.gameService.moveToNextStage(gameInstance._id)
    return $helper.wrapResult(moveResult.result, {
      advanced: moveResult.result,
      gameOver: moveResult.data === 'GAME_OVER',
      voteStatus: status
    }, moveResult.errorCode)
  },

  /**
   * 获取当前玩家在游戏中的技能状态
   * @returns {Promise<{result}>}
   */
  async getSkillStatusInGame (ctx, id) {
    const { $service, $helper, $model } = app
    const { game, player, action } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let currentUser = await $service.baseService.userInfo(ctx)

    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'

    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    if(currentPlayer){
      isOb = false
    }
    if(isOb || !currentPlayer.skill || currentPlayer.skill.length < 1){
      return $helper.wrapResult(true, [])
    }
    let skill = currentPlayer.skill
    let tmp = []
    // 查询一下当天有没有救人或者毒人，只要有2之一，女巫当晚不能再使用技能
    let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 1, from: currentPlayer.username, action: 'check'})
    let assaultAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 2, from: currentPlayer.username, action: 'assault'})
    let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, from: currentPlayer.username, action: 'antidote'})
    let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, from: currentPlayer.username, action: 'poison'})
    let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, action: 'kill'})
    skill.forEach(item=>{
      if(item.key === 'boom'){
        // 自爆只有在发言阶段可用，且存活状态才可以使用
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: gameInstance.stage === 5 && currentPlayer.status === 1, // 是否可用
          show: gameInstance.stage === 5 && currentPlayer.status === 1, // 是否显示
        })
      } else if (item.key === 'assault') {
        // 袭击只有在夜晚狼人行动是可用，且存活状态，
        let useStatus = gameInstance.stage === 2 && currentPlayer.status === 1 && item.status === 1
        if(assaultAction){
          // 使用之后，不能再使用
          useStatus = false
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: useStatus, // 狼人袭击，夜晚、存活且可用
          show: gameInstance.stage === 2 && currentPlayer.status === 1 && item.status === 1, // (是否展示在前端)存活且轮到自己行动，所以预言家在狼人之前行动，避免刚好被刀（第一晚可报查验，之后用不用也无法开口了），导致当晚技能用不了
        })
      } else if (item.key === 'check') {
        let useStatus = gameInstance.stage === 1 && currentPlayer.status === 1 && item.status === 1
        if(checkAction){
          useStatus = false
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: useStatus , // 预言家查验，只要存活可一直使用
          show: gameInstance.stage === 1 && currentPlayer.status === 1 && item.status === 1, // (是否展示在前端)存活且轮到自己行动，所以预言家在狼人之前行动，避免刚好被刀（第一晚可报查验，之后用不用也无法开口了），导致当晚技能用不了
        })
      } else if (item.key === 'antidote') {
        let useStatus = gameInstance.stage === 3 && item.status === 1 && currentPlayer.status === 1
        if(saveAction){
          useStatus = false
        }
        if(poisonAction){
          useStatus = false
        }
        if(gameInstance.witchSaveSelf === 3){
          useStatus = false
        }

        if(gameInstance.witchSaveSelf === 2 && killAction && gameInstance.day !== 1){
          // 首页之后不能自救
          if(currentPlayer.username === killAction.to){
            useStatus = false
          }
        }
        if(!killAction){
          useStatus = false
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: useStatus,
          show: gameInstance.stage === 3 && currentPlayer.status === 1, // (是否展示在前端)存活且轮到自己行动
        })
      } else if (item.key === 'poison') {
        let useStatus = gameInstance.stage === 3 && item.status === 1 && currentPlayer.status === 1
        if(saveAction){
          useStatus = false
        }
        if(poisonAction){
          useStatus = false
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: useStatus,
          show: gameInstance.stage === 3 && currentPlayer.status === 1, // (是否展示在前端)存活且轮到自己行动
        })
      } else if (item.key === 'shoot') {
        const computeHunterSkill = (stage) => {
          if(item.status !== 1){
            return false
          }
          if(stage === 4 && currentPlayer.status === 0){
            // 经过了晚上的洗礼，如果死亡
            return currentPlayer.outReason !== 'poison'
          }
          return stage === 7 && currentPlayer.status === 0;
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: computeHunterSkill(gameInstance.stage), // 猎人晚上不死于毒药可开枪, 被投出去可开枪
          show: (gameInstance.stage === 4 || gameInstance.stage === 7) && item.status === 1, // 是否展示在前端
        })
      }
    })
    return $helper.wrapResult(true, tmp)
  },

  /**
   * 获取游戏公告信息
   * @returns {Promise<{result}>}
   */
  async getBroadcastInfo(ctx, id) {
    const { $service, $helper, $model, $constants } = app
    const { game, gameTag } = $model
    const { broadcastMap } = $constants
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    if(gameInstance.status === 2){
      let info = []
      info.push({text: '游戏结束！', level: 1})
      info.push({text: gameInstance.winner === 0 ? '狼人阵营' : '好人阵营', level: gameInstance.winner === 0 ? 2 : 3})
      info.push({text: '胜利！', level: 1})
      return $helper.wrapResult(true, info)
    }
    if(gameInstance.status === 3){
      let info = []
      info.push({text: '房主结束了该场游戏，游戏已', level: 1})
      info.push({text: '结束！', level: 2})
      return $helper.wrapResult(true, info)
    }
    if(gameInstance.stage === 0 && gameInstance.day === 1) {
      return $helper.wrapResult(true, broadcastMap['1-0'])
    }

    if(gameInstance.stage === 0) {
      return $helper.wrapResult(true, broadcastMap['*-0'])
    }

    if(gameInstance.stage === 1) {
      return $helper.wrapResult(true, broadcastMap['*-1'])
    }

    if(gameInstance.stage === 2){
      return $helper.wrapResult(true, broadcastMap['*-2'])
    }

    if(gameInstance.stage === 3){
      return $helper.wrapResult(true, broadcastMap['*-3'])
    }

    if(gameInstance.stage === 4){
      let diePlayer = await $service.baseService.query(gameTag, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: { $in: [3, 4]}, // 阶段
        mode: 1
      }, {}, { sort: { position: 1}})
      if(!diePlayer || diePlayer.length < 1){
        let info = []
        info.push({text: '昨天晚上是', level: 1})
        info.push({text: '平安夜', level: 3})
        return $helper.wrapResult(true, info)
      } else {
        let dieString = ''
        let dieMap = {} // 去重，去掉狼人和女巫杀同一个人
        diePlayer.forEach((item,index)=>{
          if(dieMap[item.target]){
            return
          }
          dieMap[item.target] = item
          if(index !== 0){
            dieString = dieString + '和'
          }
          dieString = dieString + item.position + '号玩家（' + item.name + '）'
        })
        let info = []
        info.push({text: '昨天晚上死亡的是：', level: 1})
        info.push({text: dieString, level: 2})
        info.push({text: '，等待死亡玩家发动技能', level: 1})
        if(gameInstance.day === 1){
          // 第一天死亡有遗言
          info.push({text: '，且第一晚死亡有', level: 1})
          info.push({text: '遗言', level: 2})
        } else {
          info.push({text: '，没有', level: 1})
          info.push({text: '遗言', level: 2})
        }
        return $helper.wrapResult(true, info)
      }
    }

    if(gameInstance.stage === 5){
      let pkOrder = await $service.baseService.queryOne(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, desc: 'pkOrder', mode: 2})
      if(gameInstance.flatTicket === 2 && pkOrder){
        let info = []
        info.push({text:'进入', level: 1})
        info.push({text:'pk', level: 2})
        info.push({text:'环节，由', level: 1})
        info.push({text: '' + pkOrder.position + '号玩家（' + pkOrder.name + '）', level:2})
        info.push({text:'先开始发言，顺序为：', level: 1})
        info.push({text:pkOrder.value === 'asc' ? '正向' : '逆向', level: 2})
        return $helper.wrapResult(true, info)
      }
      let order = await $service.baseService.queryOne(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, desc: 'speakOrder', mode: 2})
      if(!order){
        return $helper.wrapResult(true, [{text:'进入发言环节', level: 1}])
      }
      let info = []
      info.push({text:'进入发言环节，从', level: 1})
      info.push({text: '' + order.position + '号玩家（' + order.name + '）', level:2})
      info.push({text:'开始发言，顺序为：', level: 1})
      info.push({text:order.value === 'asc' ? '正向' : '逆向', level: 2})
      return $helper.wrapResult(true, info)
    }

    if(gameInstance.stage === 6){
      return $helper.wrapResult(true, broadcastMap['*-6'])
    }
    if(gameInstance.stage === 6.5){
      return $helper.wrapResult(true, broadcastMap['*-6.5'])
    }

    if(gameInstance.stage === 7){
      let stage = 6
      let pkTag = await $service.baseService.queryOne(gameTag, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        mode: 3,
        desc: 'pkPlayer'
      })
      if(gameInstance.flatTicket === 2 && pkTag){
        // 有pk阶段
        stage = 6.5
      }

      let voteTag = await $service.baseService.queryOne(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage: stage, mode: 1})
      if(!voteTag){
        let info = []
        info.push({text:'进入审判阶段，今天没有玩家被放逐', level: 1})
        return $helper.wrapResult(true, info)
      } else {
        let info = []
        info.push({text:'' + voteTag.position + '号玩家（' + voteTag.name + '）', level: 2})
        info.push({text:'被投票', level: 1})
        info.push({text:'出局', level: 2})
        info.push({text:'，等待玩家发动技能', level: 1})
        info.push({text:'，进入审判阶段。', level: 1})
        return $helper.wrapResult(true, info)
      }
    }
    return $helper.wrapResult(true, [])
  },


  /**
   * 获取每个玩家独有的系统提示
   * @returns {Promise<{result}>}
   */
  async getSystemTips  (ctx, id) {
    const { $service, $helper, $model, $support } = app
    const { game, player, action } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let currentUser = await $service.baseService.userInfo(ctx)

    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    if(currentPlayer){
      isOb = false
    }
    if(isOb){
      return $helper.wrapResult(true, [])
    }

    if(gameInstance.status === 2){
      let info = []
      info.push({text: '游戏结束！', level: 1})
      info.push({text: gameInstance.winner === 0 ? '狼人阵营' : '好人阵营', level: gameInstance.winner === 0 ? 2 : 3})
      info.push({text: '胜利！', level: 1})
      return $helper.wrapResult(true, info)
    }
    if(currentPlayer.role === 'predictor' && (gameInstance.stage === 1 || gameInstance.stage === 2 || gameInstance.stage === 3 || gameInstance.stage === 4 || gameInstance.stage === 4)){
      // 允许在投票前显示预言家当晚的查验信息
      let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 1, action: 'check'})
      if(!checkAction){
        if(gameInstance.stage === 1){
          return $helper.wrapResult(true, [])
        }
        let info = []
        info.push({text: '你', level: 1})
        info.push({text: '预言家', level: 3})
        info.push({text: '今晚没有查验玩家', level: 1})
        return $helper.wrapResult(true, info)
      }
      let checkUsername = checkAction.to
      let checkPlayer = await $service.baseService.queryOne(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, username: checkUsername})
      let info = []
      info.push({text: '你', level: 1})
      info.push({text: '预言家', level: 3})
      info.push({text: '今晚查验的玩家为', level: 1})
      info.push({text: $support.getPlayerFullName(checkPlayer), level: 2})
      info.push({text: '他的身份为', level: 1})
      info.push({text: checkPlayer.camp === 1 ? '好人阵营' : '狼人阵营', level: checkPlayer.camp === 1 ? 3 : 2})
      return $helper.wrapResult(true, info)
    } else if (gameInstance.stage === 2 && currentPlayer.role === 'wolf'){
      let assaultAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 2, from: currentPlayer.username, action: 'assault'})
      if(assaultAction && assaultAction.to){
        let assaultPlayer = await $service.baseService.queryOne(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, username: assaultAction.to})
        let info = []
        info.push({text: '你今晚袭击了', level: 1})
        info.push({text: $support.getPlayerFullName(assaultPlayer), level: 2})
        return $helper.wrapResult(true, info)
      } else {
        let info = []
        info.push({text: '请确认您的同伴，并讨论要袭击的玩家', level: 3})
        return $helper.wrapResult(true, info)
      }
      return $helper.wrapResult(true, [])
    } else if ((gameInstance.stage === 3 || gameInstance.stage === 4) && currentPlayer.role === 'wolf') {
      let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 2, action: 'kill'})
      if(!killAction){
        let info = []
        info.push({text: '你们', level: 1})
        info.push({text: '狼人团队', level: 2})
        info.push({text: '晚上没有袭击玩家', level: 1})
        return $helper.wrapResult(true, info)
      }
      let killUsername = killAction.to
      let killPlayer = await $service.baseService.queryOne(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, username: killUsername})
      let info = []
      info.push({text: '你们', level: 1})
      info.push({text: '狼人团队', level: 2})
      info.push({text: '晚上袭击了', level: 1})
      info.push({text: $support.getPlayerFullName(killPlayer), level: 3})
      return $helper.wrapResult(true, info)
    } else if ((gameInstance.stage === 3) && currentPlayer.role === 'witch') {
      let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 2, action: 'kill'})
      if(!killAction){
        let info = []
        info.push({text: '今晚没有玩家', level: 1})
        info.push({text: '死亡', level: 2})
        return $helper.wrapResult(true, info)
      }
      let dieUsername = killAction.to
      let diePlayer = await $service.baseService.queryOne(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, username: dieUsername})
      let currentSkills = currentPlayer.skill
      let antidoteSkill
      currentSkills.forEach(item=>{
        if(item.key === 'antidote'){
          antidoteSkill = item
        }
      })

      let info = []
      if(antidoteSkill && antidoteSkill.status === 1 && currentPlayer.status === 1){
        info.push({text: '昨晚死亡的是', level: 1})
        info.push({text: $support.getPlayerFullName(diePlayer), level: 2,})
        if(killAction.to === currentPlayer.username && gameInstance.day !== 1 && gameInstance.witchSaveSelf === 2){
          info.push({text: '，女巫非首页不能自救，', level: 2,})
          info.push({text: '请选择是否', level: 1})
        } else if (gameInstance.witchSaveSelf === 3) {
          info.push({text: '，女巫不能自救，', level: 2,})
          info.push({text: '请选择是否', level: 1})
        } else {
          info.push({text: '，', level: 1})
          info.push({text: '请选择使用', level: 1})
          info.push({text: '解药', level: 3})
          info.push({text: '或者', level: 1})
        }
      }
      info.push({text: '使用', level: 1})
      info.push({text: '毒药', level: 2})
      info.push({text: '毒杀别的玩家', level: 1})

      let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'antidote'})
      if(saveAction){
        let savePlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: saveAction.to})
        info = []
        info.push({text: '昨晚死亡的是', level: 1})
        info.push({text: $support.getPlayerFullName(savePlayer), level: 2})
        info.push({text: '，你使用了', level: 1})
        info.push({text: '解药', level: 3})
        info.push({text: '救了', level: 1})
        info.push({text: $support.getPlayerFullName(savePlayer) , level: 3})
      }
      let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'poison'})
      if(poisonAction){
        let poisonPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: poisonAction.to})
        info = []
        info.push({text: '你使用了毒药毒死了', level: 1})
        info.push({text: $support.getPlayerFullName(poisonPlayer) , level: 2})
      }
      return $helper.wrapResult(true, info)
    } else if (gameInstance.stage === 4 && currentPlayer.role === 'hunter') {
      if(currentPlayer.status === 0){
        let info = []
        info.push({text: '你已', level: 1})
        info.push({text: '出局', level: 2})
        let skills = currentPlayer.skill
        let skill
        skills.forEach(item=>{
          if(item.key === 'shoot'){
            skill = item
            return
          }
        })
        if(skill && skill.status === 0){
          // 使用过技能了
          return $helper.wrapResult(true, info)
        }
        if(currentPlayer.outReason !== 'poison'){
          info.push({text: '，你现在可以发动', level: 1})
          info.push({text: '技能', level: 3})
        } else {
          info.push({text: '，你被', level: 1})
          info.push({text: '，毒药毒死，', level: 2})
          info.push({text: '无法发动技能', level: 1})
        }
        return $helper.wrapResult(true, info)
      }
    } else if (gameInstance.stage === 6){
      let voteAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 6, from: currentPlayer.username, action: 'vote'})
      if(voteAction && voteAction.to){
        let votePlayer = await $service.baseService.queryOne(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, username: voteAction.to})
        let info = []
        info.push({text: '你今天投票给', level: 1})
        info.push({text: $support.getPlayerFullName(votePlayer), level: 2})
        return $helper.wrapResult(true, info)
      }
      return $helper.wrapResult(true, [])
    }
    else if (gameInstance.stage === 6.5){
      let voteAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 6.5, from: currentPlayer.username, action: 'vote'})
      if(voteAction && voteAction.to){
        let votePlayer = await $service.baseService.queryOne(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, username: voteAction.to})
        let info = []
        info.push({text: '你今天投票给', level: 1})
        info.push({text: $support.getPlayerFullName(votePlayer), level: 2})
        return $helper.wrapResult(true, info)
      }
      return $helper.wrapResult(true, [])
    }
    return $helper.wrapResult(true, [])
  },

  /**
   * 获取玩家在游戏中的动作状态
   * @returns {Promise<{result}>}
   */
  async getActionStatusInGame (ctx, id) {
    const { $service, $helper, $model } = app
    const { game, player, action, gameTag } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let currentUser = await $service.baseService.userInfo(ctx)

    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    if(currentPlayer){
      isOb = false
    }
    if(isOb){
      return $helper.wrapResult(true, [])
    }

    if(gameInstance.stage === 6) {
      let useStatus = gameInstance.stage === 6 && currentPlayer.status === 1
      let voteAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 6, from: currentPlayer.username, action: 'vote'})
      if(voteAction){
        // 您已经投过票了
        useStatus = false
      }
      let actions = [
        {
          key: 'vote',
          name: '投票',
          canUse: useStatus,
          show: gameInstance.stage === 6 && currentPlayer.status === 1,
        }
      ]
      return $helper.wrapResult(true, actions)
    } else if (gameInstance.stage === 6.5) {
      let useStatus = gameInstance.stage === 6.5 && currentPlayer.status === 1
      let voteAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 6.5, from: currentPlayer.username, action: 'vote'})
      let pkTag = await $service.baseService.queryOne(gameTag, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        mode: 3,
        desc: 'pkPlayer'
      })
      let pkPlayer = pkTag && pkTag.value2
      if(voteAction){
        // 您已经投过票了
        useStatus = false
      }

      if(pkPlayer && pkPlayer.length > 0 && pkPlayer.includes(currentPlayer.username)){
        // 你是pk中的玩家，不允许投票
        useStatus = false
      }
      let actions = [
        {
          key: 'vote',
          name: '投票',
          canUse: useStatus,
          show: gameInstance.stage === 6.5 && currentPlayer.status === 1,
        }
      ]
      return $helper.wrapResult(true, actions)
    }
    return $helper.wrapResult(true, [])
  },

  /**
   * 获取游戏是否结束 优先判断好人阵营死亡情况，在夜晚狼人先刀。
   * @returns {Promise<{result}>}
   */
  async settleGameOver (id) {
    const { $service, $helper, $model } = app
    const { game, player } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)

    let goodAlive = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, camp: 1, status: 1})
    if(!goodAlive || goodAlive.length < 1){
      // 好人全死
      return await $service.gameService.setGameWin(id, 0)
    }

    let villagerAlive = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, role: 'villager', status: 1})
    if((!villagerAlive || villagerAlive.length < 1) && gameInstance.winCondition === 1){
      // 屠边 - 村民 => 游戏结束，狼人胜利
      return await $service.gameService.setGameWin(id, 0)
    }

    let clericAlive = await $service.baseService.query(player,{
      gameId: gameInstance._id,
      roomId: gameInstance.roomId,
      role: { $in: ['predictor', 'witch', 'hunter']},
      status: 1
    })

    if((!clericAlive || clericAlive.length < 1) && gameInstance.winCondition === 1){
      // 屠边 - 屠神 => 游戏结束，狼人胜利
      return await $service.gameService.setGameWin(id, 0)
    }

    let wolfAlive = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, role: 'wolf', status: 1})
    if(!wolfAlive || wolfAlive.length < 1){
      // 狼人死完 => 游戏结束，好人胜利
      return await $service.gameService.setGameWin(id, 1)
    }
    // 游戏未结束
    return $helper.wrapResult(true , 'N')
  },

  /**
   * 游戏赢家
   * @param id
   * @param camp
   * @returns {Promise<{result}>}
   */
  async setGameWin (id, camp) {
    const { $service, $helper, $model, $ws } = app
    const { game, record } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    if(camp === null || camp === undefined){
      return $helper.wrapResult(false, '游戏赢家为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    const updatedGameInstance = await $service.baseService.updateById(game, gameInstance._id,{status: 2, winner: camp})
    let recordObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 1,
      isTitle: 0,
      content: {
        type: 'rich-text',
        content: [
          {
            text: '游戏结束！',
            level: 1,
          },
          {
            text: camp === 0 ? '狼人阵营' : '好人阵营',
            level: camp === 0 ? 2 : 3,
          },
          {
            text: '赢得',
            level: 1,
          },
          {
            text: '胜利！',
            level: 3,
          },
        ]
      }
    }
    await $service.baseService.save(record, recordObject)
    const replayGameInstance = updatedGameInstance || {
      ...(gameInstance.toJSON ? gameInstance.toJSON() : gameInstance),
      status: 2,
      winner: camp
    }
    $service.replayService.triggerGameReplay(replayGameInstance)
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('gameOver')
        conn.sendText(JSON.stringify({
          type: 'stageCue',
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: 'gameOver',
          text: '游戏结算，' + (camp === 0 ? '狼人阵营' : '好人阵营') + '获得胜利。'
        }))
      }
    })
    return $helper.wrapResult(true , 'Y')
  },

  /**
   * 进入下一个阶段
   * @param gameId
   * @returns {Promise<{result}>}
   */
  async moveToNextStage (gameId, options = {}) {
    const { $service, $helper, $model, $ws, $nodeCache } = app
    const { game, record } = $model

    if(!gameId || gameId === ''){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }

    const moveLockKey = 'stage-move-lock-' + gameId
    if($nodeCache.get(moveLockKey)){
      console.log('[moveToNextStage] duplicated move blocked', { gameId })
      return $helper.wrapResult(true, { advanced: false, locked: true })
    }
    $nodeCache.set(moveLockKey, 1, 3)

    let gameInstance = await $service.baseService.queryById(game, gameId)
    let stage = gameInstance.stage
    let nextStage;
    
    // 强制固定夜晚流程，绝对不会跳阶段
    if (stage === 0) nextStage = 1;
    else if (stage === 1) nextStage = 2;   // 预言家 → 狼人
    else if (stage === 2) nextStage = 3;   // 狼人 → 女巫 【关键修复】
    else if (stage === 3) nextStage = 4;   // 女巫 → 天亮
    else if (stage === 4) nextStage = 5;
    else if (stage === 5) nextStage = 6;
    else if (stage === 6) nextStage = 7;
    else if (stage === 6.5) nextStage = 7;
    else if (stage === 7) nextStage = 0;
    else nextStage = stage + 1;

    if( stage === 1){
      const predictorSettleResult = await $service.stageService.predictorStage(gameInstance._id)
      if(!predictorSettleResult.result){
        return predictorSettleResult
      }
    } else if(stage === 2){
      // 结算狼人的实际击杀目标
      const wolfSettleResult = await $service.stageService.wolfStage(gameInstance._id)
      if(!wolfSettleResult.result){
        return wolfSettleResult
      }
    } else if(stage === 3){
      const witchSettleResult = await $service.stageService.witchStage(gameInstance._id)
      if(!witchSettleResult.result){
        return witchSettleResult
      }
      await $service.gameService.settleGameOver(gameInstance._id)
      const afterWitchGame = await $service.baseService.queryById(game, gameInstance._id)
      if(afterWitchGame && Number(afterWitchGame.status) === 2){
        return $helper.wrapResult(true, 'GAME_OVER')
      }
    } else if (stage === 4) {
      const preSpeakSettleResult = await $service.stageService.preSpeakStage(gameInstance._id)
      if(!preSpeakSettleResult.result){
        return preSpeakSettleResult
      }
    } else if (stage === 6) {
      // 投票 => 审判/pk加赛，需要整理票型，结算死亡玩家
      const voteSettleResult = await $service.stageService.voteStage(gameInstance._id, 6, {
        forceSettle: !!options.forceVoteSettlement
      })
      if(!voteSettleResult.result){
        return voteSettleResult
      }
      const afterVoteGame = await $service.baseService.queryById(game, gameInstance._id)
      if(afterVoteGame && Number(afterVoteGame.status) === 2){
        return $helper.wrapResult(true, 'GAME_OVER')
      }
      if(voteSettleResult.result && voteSettleResult.data === 'Y'){
        // 需要pk
        nextStage = 6.5
      }
    } else if (stage === 6.5){
      // 投票pk加赛 => 审判，需要整理票型，结算死亡玩家
      const pkVoteSettleResult = await $service.stageService.voteStage(gameInstance._id, 6.5, {
        forceSettle: !!options.forceVoteSettlement
      })
      if(!pkVoteSettleResult.result){
        return pkVoteSettleResult
      }
      const afterPkVoteGame = await $service.baseService.queryById(game, gameInstance._id)
      if(afterPkVoteGame && Number(afterPkVoteGame.status) === 2){
        return $helper.wrapResult(true, 'GAME_OVER')
      }
      nextStage = 7
    }

    // 修改游戏状态
    var nextStageUpdate = {stage: nextStage}
    
    // 如果进入审判阶段，初始化投票出局玩家发言轮次
    var nextStageUpdate = {stage: nextStage}

    if(nextStage === 7){
      let lastWordsResult = await $service.stageService.initLastWordsStage(gameInstance._id)
      if(!lastWordsResult.result){
        return lastWordsResult
      }
      console.log('进入审判阶段，房主可以手动控制游戏流程')
    }
    if(nextStage === 0){
      nextStageUpdate.day = gameInstance.day + 1
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day + 1,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          text: '天黑请闭眼',
          type: 'text',
          level: 1,
        }
      }
      await $service.baseService.save(record, recordObject)
    }
    await $service.baseService.updateById(game, gameInstance._id, nextStageUpdate)

    // 倒计时 timer
    let updateGame = await $service.baseService.queryById(game, gameId)
    const updateStageNumber = Number(updateGame.stage)
    setImmediate(async () => {
      try {
        let latestGame = await $service.baseService.queryById(game, gameId)
        let aiRunResult = await $service.aiService.runAiForStage(latestGame)
        if(!aiRunResult.result){
          app.$log4.errorLogger.error('[gameService] run ai for stage failed: ' + aiRunResult.errorMessage)
          return
        }
        latestGame = await $service.baseService.queryById(game, gameId)
        $ws.connections.forEach(function (conn) {
          let url = '/lrs/' + latestGame.roomId
          if(conn.path === url){
            conn.sendText('refreshGame')
          }
        })
        let autoAdvanceResult = await $service.aiService.shouldAutoAdvanceStage(latestGame)
        if(autoAdvanceResult.result && autoAdvanceResult.data === true){
          $nodeCache.set('game-time-' + latestGame._id, -1)
          if(app.$timer[latestGame._id]){
            clearInterval(app.$timer[latestGame._id])
            delete app.$timer[latestGame._id]
          }
          await $service.gameService.moveToNextStage(gameId)
        }
      } catch (e) {
        app.$log4.errorLogger.error('[gameService] async run ai for stage failed: ' + e.toString())
      }
    })
    const hasStageTimer = updateStageNumber === 1 || updateStageNumber === 2 || updateStageNumber === 3 || updateStageNumber === 6 || updateStageNumber === 6.5
    if(hasStageTimer){
    //if(updateGame.stage === 1 || updateGame.stage === 2 || updateGame.stage === 3){
      // 预言家
      var legacyTimerSeconds = updateStageNumber === 1 ? gameInstance.p1 : 30
      let stageTimerSeconds = updateStageNumber === 1 ? gameInstance.p1 : 30
      if(updateStageNumber === 2){
        stageTimerSeconds = gameInstance.p2 || 30
      }
      if(updateStageNumber === 3){
        stageTimerSeconds = gameInstance.p3 || 30
      }
      if(updateStageNumber === 6 || updateStageNumber === 6.5){
        stageTimerSeconds = 45
      }

      if(app.$timer[gameInstance._id]){
        clearInterval(app.$timer[gameInstance._id])
        delete app.$timer[gameInstance._id]
      }

      $nodeCache.set('game-time-' + gameInstance._id, stageTimerSeconds)
      app.$timer[gameInstance._id] = setInterval(function (){
        let time = Number($nodeCache.get('game-time-' + gameInstance._id))
        if(time <= 0){
          // 清掉定时器
          $nodeCache.set('game-time-' + gameInstance._id, -1)
          clearInterval(app.$timer[gameInstance._id])
          delete app.$timer[gameInstance._id]
          $service.baseService.queryById(game, gameInstance._id).then(latestGame => {
            if(
              latestGame &&
              Number(latestGame.stage) === updateStageNumber &&
              Number(latestGame.day) === Number(updateGame.day)
            ){
              const forceVoteSettlement = updateStageNumber === 6 || updateStageNumber === 6.5
              $service.gameService.moveToNextStage(gameInstance._id, {
                forceVoteSettlement
              }).then(result => {
                if(!result.result){
                  console.log('[stageTimer] auto move blocked', {
                    gameId: gameInstance._id,
                    roomId: gameInstance.roomId,
                    day: latestGame.day,
                    stage: updateStageNumber,
                    errorMessage: result.errorMessage
                  })
                }
              })
            }
          })
        } else {
          $nodeCache.set('game-time-' + gameInstance._id, time - 1)
          let data = {
            'refreshGame': false,
            'time': time,
          }
          $ws.connections.forEach(function (conn) {
            let url = '/lrs/' + gameInstance.roomId
            if(conn.path === url){
              conn.sendText(JSON.stringify(data))
            }
          })
        }
      }, 1000)
    }

    const stageCueTextMap = {
      0: '天黑请闭眼。',
      1: '预言家请睁眼，请选择你要查验的玩家。',
      2: '狼人请睁眼，请选择你要袭击的玩家。',
      3: '女巫请睁眼，请选择是否使用药水。',
      4: '天亮了。',
      5: '发言环节开始。',
      6: '投票环节开始，请开始投票。',
      6.5: '加赛投票环节开始。',
      7: '审判阶段开始。'
    }
    const stageCueText = stageCueTextMap[updateStageNumber]

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('stageChange')
        if(stageCueText){
          conn.sendText(JSON.stringify({
            type: 'stageCue',
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: updateGame.day,
            stage: updateStageNumber,
            text: stageCueText
          }))
        }
      }
    })

    if(!hasStageTimer){
      // 发送刷新消息，时间设为0表示无倒计时
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
    } else {
      let data = {
        'refreshGame': false,
        'time': $nodeCache.get('game-time-' + gameInstance._id),
      }
      $ws.connections.forEach(function (conn) {
        let url = '/lrs/' + gameInstance.roomId
        if(conn.path === url){
          conn.sendText(JSON.stringify(data))
        }
      })
    }

    $nodeCache.del(moveLockKey)
    return $helper.wrapResult(true,'Y')
  }
})
