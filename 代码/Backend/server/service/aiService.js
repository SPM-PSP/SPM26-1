const axios = require('axios')

module.exports = app => {
  const getBaseUrl = () => {
    return process.env.AI_SERVICE_BASE_URL ||
      (app.$config.aiService && app.$config.aiService.baseUrl) ||
      'http://127.0.0.1:8001'
  }

  const getTimeout = () => {
    return (app.$config.aiService && app.$config.aiService.timeout) || 30000
  }

  const post = async (path, data) => {
    const { $helper, $log4 } = app
    const url = getBaseUrl() + path
    const startTime = Date.now()
    console.log('[aiService] 请求AI服务:', url)
    console.log('[aiService] 请求超时设置:', getTimeout() + 'ms')
    console.log('[aiService] 请求数据:', JSON.stringify(data, null, 2))
    
    try {
      const res = await axios({
        method: 'post',
        url: url,
        data,
        timeout: getTimeout(),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const endTime = Date.now()
      const duration = endTime - startTime
      console.log('[aiService] 请求耗时:', duration + 'ms')
      console.log('[aiService] 响应状态:', res.status)
      console.log('[aiService] 响应数据:', JSON.stringify(res.data, null, 2))
      
      const body = res.data || {}
      if(body.code !== undefined && body.code !== 200){
        return $helper.wrapResult(false, body.message || 'ai service error', body.code)
      }
      return $helper.wrapResult(true, body.data === undefined ? body : body.data)
    } catch (e) {
      const errorMsg = 'ai service unavailable: ' + e.message
      console.log('[aiService] 请求失败:', errorMsg)
      console.log('[aiService] 错误详情:', e.toString())
      if($log4 && $log4.errorLogger){
        $log4.errorLogger.error('[aiService] post ' + path + ' failed: ' + e.toString())
      }
      return $helper.wrapResult(false, errorMsg, -1)
    }
  }

  const get = async (path) => {
    const { $helper, $log4 } = app
    const url = getBaseUrl() + path
    console.log('[aiService] GET请求AI服务:', url)
    
    try {
      const res = await axios({
        method: 'get',
        url: url,
        timeout: getTimeout(),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      console.log('[aiService] 响应状态:', res.status)
      console.log('[aiService] 响应数据:', JSON.stringify(res.data, null, 2))
      
      const body = res.data || {}
      if(body.code !== undefined && body.code !== 200){
        return $helper.wrapResult(false, body.message || 'ai service error', body.code)
      }
      return $helper.wrapResult(true, body.data === undefined ? body : body.data)
    } catch (e) {
      const errorMsg = 'ai service unavailable: ' + e.message
      console.log('[aiService] GET请求失败:', errorMsg)
      console.log('[aiService] 错误详情:', e.toString())
      if($log4 && $log4.errorLogger){
        $log4.errorLogger.error('[aiService] get ' + path + ' failed: ' + e.toString())
      }
      return $helper.wrapResult(false, errorMsg, -1)
    }
  }

  const isAiId = (username) => {
    return /^ai_\d+$/.test(username || '')
  }

  const toAiRole = (role) => {
    const map = {
      wolf: 'werewolf',
      predictor: 'seer',
      witch: 'witch',        // 女巫角色映射，如果AI服务期望不同名称，可能需要调整为 'poisoner' 或 'witch'
      hunter: 'hunter',
      villager: 'villager'
    }
    return map[role] || role
  }

  return ({
    isAiId,

    async checkConnection() {
      try {
        console.log('[aiService] 检查AI服务连通性...')
        const result = await get('/health')
        if(result.result) {
          console.log('[aiService] AI服务连接正常')
          return true
        } else {
          console.log('[aiService] AI服务响应异常:', result.errorMessage)
          return false
        }
      } catch (e) {
        console.log('[aiService] AI服务连接失败:', e.message)
        return false
      }
    },

    async createAiSeatPlayers(ctx, roomId, aiCount) {
      const { $service, $helper, $model } = app
      const { room, user } = $model
      const roomInstance = await $service.baseService.queryById(room, roomId)
      if(!roomInstance){
        return $helper.wrapResult(false, 'room not found', -1)
      }
      const currentUser = await $service.baseService.userInfo(ctx)
      if(roomInstance.owner !== currentUser.username){
        return $helper.wrapResult(false, 'only room owner can add ai seats', -1)
      }
      if(roomInstance.status !== 0){
        return $helper.wrapResult(false, 'cannot add ai seats after game starts', -1)
      }

      const count = Number(roomInstance.count) || 9
      const created = []
      let aiIndex = 1
      for(let seat = 1; seat <= count && created.length < aiCount; seat++){
        if(roomInstance['v' + seat]){
          continue
        }
        const aiId = 'ai_' + aiIndex
        let aiUser = await $service.baseService.queryOne(user, { username: aiId })
        if(!aiUser){
          const pass = await $helper.createPassword('ai-player')
          aiUser = await $service.baseService.save(user, {
            username: aiId,
            name: 'AI Player ' + aiIndex,
            password: pass,
            roles: ['player', 'ai'],
            defaultRole: 'ai',
            defaultRoleName: 'AI'
          })
        }
        const updateObj = {}
        updateObj['v' + seat] = aiId
        await $service.baseService.updateById(room, roomInstance._id, updateObj)
        created.push({
          seat,
          aiId,
          username: aiId,
          userId: aiUser._id,
          name: aiUser.name
        })
        aiIndex++
      }

      if(created.length !== aiCount){
        return $helper.wrapResult(false, 'not enough empty seats for ai players', -1)
      }
      return $helper.wrapResult(true, created)
    },

    async bootstrapGame(gameInstance, aiCount, options = {}) {
      if(aiCount < 1){
        return app.$helper.wrapResult(true, null)
      }
      
      // 先检查AI服务连通性
      const isConnected = await this.checkConnection()
      if(!isConnected) {
        return app.$helper.wrapResult(false, 'AI服务连接失败，请检查服务地址: ' + getBaseUrl(), -1)
      }
      
      const payload = {
        gameId: String(gameInstance._id),
        roomId: String(gameInstance.roomId),
        aiCount,
        asyncMode: options.asyncMode !== false
      }
      if(options.personaAssignments){
        payload.personaAssignments = options.personaAssignments
      }
      if(options.modelPolicy){
        payload.modelPolicy = options.modelPolicy
      }
      return await post('/internal/ai/bootstrap', payload)
    },

    async assignRoles(gameInstance, aiPlayers) {
      const assignments = (aiPlayers || [])
        .filter(item => isAiId(item.username))
        .map(item => ({
          aiId: item.username,
          role: toAiRole(item.role)
        }))
      if(assignments.length < 1){
        return app.$helper.wrapResult(true, null)
      }
      return await post('/internal/ai/players/roles/assign', {
        gameId: String(gameInstance._id),
        assignments
      })
    },

    async appendMemoryEvent(gameInstance, aiId, event, options = {}) {
      return await post('/internal/ai/memory/event', {
        gameId: String(gameInstance._id),
        aiId,
        event,
        candidateTargets: options.candidateTargets || [],
        asyncMode: options.asyncMode === true
      })
    },

    async invokeAgent(gameInstance, aiId, params = {}) {
      // 获取AI玩家的角色信息
      const { $service, $model } = app
      const { player } = $model
      const aiPlayer = await $service.baseService.queryOne(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        username: aiId
      })
      
      return await post('/internal/ai/agent/invoke', {
        requestId: params.requestId || ('req_' + gameInstance._id + '_' + aiId + '_' + Date.now()),
        gameId: String(gameInstance._id),
        aiId,
        stage: params.stage,
        role: aiPlayer ? toAiRole(aiPlayer.role) : undefined, // 添加角色信息，转换为AI端识别的角色名
        persona: params.persona || 'logical', // 添加persona
        visibleEvents: params.visibleEvents || [],
        alivePlayers: params.alivePlayers || [],
        candidateTargets: params.candidateTargets || [],
        privateVision: params.privateVision || {},
        callbackUrl: params.callbackUrl,
        asyncMode: params.asyncMode === true
      })
    },

    async runAiForStage(gameInstance) {
      const { $service, $helper, $model } = app
      const { player, action, record, vision } = $model
      if(!gameInstance || gameInstance.status !== 1){
        return $helper.wrapResult(true, [])
      }
      let aiPlayers = await $service.baseService.query(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        username: { $like: 'ai_%' },
        status: 1
      }, {}, { sort: { position: 1 } })
      if(!aiPlayers || aiPlayers.length < 1){
        return $helper.wrapResult(true, [])
      }

      const alivePlayers = await $service.baseService.query(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        status: 1
      }, {}, { sort: { position: 1 } })
      const aliveIds = (alivePlayers || []).map(item => item.username)
      if(gameInstance.stage === 5){
        const turnResult = await $service.gameService.getSpeechTurnState(gameInstance)
        if(!turnResult.result || !turnResult.data || turnResult.data.finished || !turnResult.data.currentSpeaker){
          return $helper.wrapResult(true, [])
        }
        if(!isAiId(turnResult.data.currentSpeaker.username)){
          return $helper.wrapResult(true, [])
        }
        const speechLockKey = [
          'ai-speech',
          gameInstance._id,
          gameInstance.day,
          turnResult.data.currentIndex,
          turnResult.data.currentSpeaker.username
        ].join('-')
        if(app.$nodeCache.get(speechLockKey)){
          return $helper.wrapResult(true, [])
        }
        app.$nodeCache.set(speechLockKey, 1, 120)
        const currentAi = aiPlayers.find(item => item.username === turnResult.data.currentSpeaker.username)
        if(!currentAi){
          app.$nodeCache.del(speechLockKey)
          return $helper.wrapResult(true, [])
        }
        aiPlayers = [currentAi]
      }
      const recentRecords = await $service.baseService.query(record, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        isCommon: 1
      }, {}, { sort: { _id: -1 }, limit: 20 })
      const visibleEvents = (recentRecords || []).reverse().map(item => {
        // 只传递发言内容，移除身份信息
        let content = ''
        if (item.content) {
          if (item.content.text) {
            content = item.content.text
          } else if (item.content.type === 'speech' && item.content.from) {
            // 对于发言事件，只包含发言者基本信息（不含角色）
            const speakerInfo = {
              username: item.content.from.username,
              name: item.content.from.name,
              position: item.content.from.position
            }
            content = `${speakerInfo.name}(${speakerInfo.position}号): ${item.content.text || ''}`
          } else {
            // 对于其他类型的事件，只传递非敏感信息
            const cleanContent = { ...item.content }
            if (cleanContent.from) {
              delete cleanContent.from.role
              delete cleanContent.from.camp
            }
            content = JSON.stringify(cleanContent)
          }
        }
        return {
          day: item.day,
          stage: item.stage,
          eventType: item.content && item.content.type ? item.content.type : 'record',
          content: content || JSON.stringify({})
        }
      })

      const getTargetPlayer = async (target) => {
        if(!target){
          return null
        }
        return await $service.baseService.queryOne(player, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          username: target
        })
      }

      const saveActionIfNeeded = async (actor, target, actionName) => {
        if(!actor || !target || !actionName){
          return null
        }
        let exist = await $service.baseService.queryOne(action, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          from: actor.username,
          action: actionName
        })
        if(exist){
          return exist
        }
        const savedAction = await $service.baseService.save(action, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          from: actor.username,
          to: target.username,
          action: actionName
        })
        
        // 如果是投票行为，向AI服务发送投票事件（使用广播接口）
        if (actionName === 'vote') {
          try {
            const voteEvent = {
              day: gameInstance.day,
              stage: gameInstance.stage,
              eventType: 'vote',
              speaker: actor.username,
              content: `投票给 ${target.name}(${target.position}号)`,
              weight: 1.0,
              targets: [target.username]
            }
            
            // 获取所有存活玩家作为候选目标
            const alivePlayers = await $service.baseService.query(player, {
              roomId: gameInstance.roomId,
              gameId: gameInstance._id,
              status: 1
            })
            const candidateTargets = alivePlayers.map(p => p.username)
            
            // 获取所有AI玩家
            const aiPlayers = alivePlayers.filter(p => p.username.startsWith('ai_'))
            const aiIds = aiPlayers.map(p => p.username)
            
            // 使用广播接口发送事件给所有AI
            await post('/internal/ai/game/events/broadcast', {
              gameId: String(gameInstance._id),
              event: voteEvent,
              aiIds: aiIds, // 指定要发送的AI列表
              candidateTargets: candidateTargets,
              asyncMode: true
            })
          } catch (error) {
            // AI服务调用失败不影响投票功能，只记录日志
            if(app.$log4 && app.$log4.errorLogger){
              app.$log4.errorLogger.error('[AI Service] 发送AI投票事件失败: ' + error.toString())
            }
          }
        }
        
        return savedAction
      }

      const appendAiSpeech = async (actor, speechText) => {
        if(!speechText){
          return null
        }
        const savedRecord = await $service.baseService.save(record, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 1,
          isTitle: 0,
          content: {
            type: 'speech',
            source: 'ai',
            text: speechText,
            from: {
              username: actor.username,
              name: actor.name,
              position: actor.position
              // 移除 role 和 camp 信息，防止身份泄露
            }
          }
        })
        
        // 向AI服务发送AI发言事件（使用广播接口）
        try {
          const speechEvent = {
            day: gameInstance.day,
            stage: gameInstance.stage,
            eventType: 'speech',
            speaker: actor.username,
            content: speechText,
            weight: 1.0,
            targets: [] // AI发言通常没有特定目标，其他AI会自己分析内容
          }
          
          // 获取所有存活玩家作为候选目标
          const { player } = $model
          const alivePlayers = await $service.baseService.query(player, {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            status: 1
          })
          const candidateTargets = alivePlayers.map(p => p.username)
          
          // 获取所有AI玩家
          const aiPlayers = alivePlayers.filter(p => p.username.startsWith('ai_'))
          const aiIds = aiPlayers.map(p => p.username)
          
          // 使用广播接口发送事件给所有AI
          await post('/internal/ai/game/events/broadcast', {
            gameId: String(gameInstance._id),
            event: speechEvent,
            aiIds: aiIds, // 指定要发送的AI列表
            candidateTargets: candidateTargets,
            asyncMode: true
          })
        } catch (error) {
          // AI服务调用失败不影响发言功能，只记录日志
          if(app.$log4 && app.$log4.errorLogger){
            app.$log4.errorLogger.error('[AI Service] 发送AI发言事件失败: ' + error.toString())
          }
        }
        
        return savedRecord
      }

      const results = []
      const wolfPlayers = (alivePlayers || []).filter(item => item.role === 'wolf')
      const buildPrivateVision = async (actor) => {
        if(actor.role === 'wolf'){
          // 狼人逻辑
          const assaultActions = await $service.baseService.query(action, {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: 2,
            action: 'assault'
          })
          const targetCount = {}
          ;(assaultActions || []).forEach(item => {
            if(item.to){
              targetCount[item.to] = (targetCount[item.to] || 0) + 1
            }
          })
          let consensusTarget = null
          let maxCount = 0
          Object.keys(targetCount).forEach(username => {
            if(targetCount[username] > maxCount){
              maxCount = targetCount[username]
              consensusTarget = username
            }
          })
          
          const wolfTeammates = wolfPlayers.filter(wolf => wolf.username !== actor.username).map(wolf => wolf.username)
          const humanWolves = wolfPlayers.filter(wolf => !wolf.username.startsWith('ai_'))
          const hasHumanWolf = humanWolves.length > 0
          
          return {
            wolfTeammates,
            consensusTarget,
            wolfDecisionMode: hasHumanWolf ? 'advice_only' : 'auto_execute'
          }
        } else if(actor.role === 'predictor'){
          // 预言家不需要privateVision，角色信息通过顶层role传递
          return {}
        } else if(actor.role === 'witch'){
          // 女巫逻辑 - 只在夜间阶段传递privateVision
          if(gameInstance.stage !== 3) {
            // 非夜间阶段，不传递女巫的privateVision信息
            return {}
          }
          
          const witchSkills = actor.skill || []
          const antidoteSkill = witchSkills.find(skill => skill.key === 'antidote')
          const poisonSkill = witchSkills.find(skill => skill.key === 'poison')
          
          // 检查当晚是否有死亡玩家（女巫可以救）
          const killActions = await $service.baseService.query(action, {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: 2,
            action: 'assault'
          })
          
          const nightDeathCandidate = killActions.length > 0 ? killActions[0].to : null
          
          return {
            nightDeathCandidate,
            antidoteAvailable: antidoteSkill ? antidoteSkill.status === 1 : false,
            poisonAvailable: poisonSkill ? poisonSkill.status === 1 : false
          }
        } else {
          return {}
        }
      }

      for(let i = 0; i < aiPlayers.length; i++){
        const actor = aiPlayers[i]
        let stageName = null
        let actionName = null
        let candidateTargets = aliveIds.filter(username => username !== actor.username)

        if(gameInstance.stage === 1 && actor.role === 'predictor'){
          stageName = 'night_action'
          actionName = 'check'
        } else if(gameInstance.stage === 2 && actor.role === 'wolf'){
          stageName = 'night_action'
          actionName = 'assault'
        } else if(gameInstance.stage === 3 && actor.role === 'witch'){
          stageName = 'night_action'
        } else if(gameInstance.stage === 5){
          stageName = 'speech'
        } else if(gameInstance.stage === 6 || gameInstance.stage === 6.5){
          stageName = 'vote'
          actionName = 'vote'
        }

        if(!stageName){
          continue
        }

        const invokeResult = await this.invokeAgent(gameInstance, actor.username, {
          stage: stageName,
          visibleEvents,
          alivePlayers: aliveIds,
          candidateTargets,
          privateVision: await buildPrivateVision(actor),
          asyncMode: false
        })
        if(!invokeResult.result){
          results.push({ aiId: actor.username, success: false, error: invokeResult.errorMessage })
          continue
        }

        const decision = invokeResult.data && invokeResult.data.decision ? invokeResult.data.decision : {}
        if(stageName === 'speech'){
          await appendAiSpeech(actor, decision.speechText)
          app.$ws.connections.forEach(function (conn) {
            let url = '/lrs/' + gameInstance.roomId
            if(conn.path === url){
              conn.sendText('refreshGame')
            }
          })
          const advanceResult = await $service.gameService.advanceSpeechTurn(gameInstance)
          if(advanceResult.result){
            if(advanceResult.data.finished){
              await $service.gameService.moveToNextStage(gameInstance._id)
            } else if(advanceResult.data.currentSpeaker && isAiId(advanceResult.data.currentSpeaker.username)){
              setImmediate(async () => {
                const latestGame = await $service.baseService.queryById($model.game, gameInstance._id)
                await $service.aiService.runAiForStage(latestGame)
              })
            }
          }
          results.push({ aiId: actor.username, success: true, action: 'speech' })
          continue
        }

        if(gameInstance.stage === 3 && actor.role === 'witch'){
          if(decision.skillType === 'antidote'){
            const killAction = await $service.baseService.queryOne(action, {
              roomId: gameInstance.roomId,
              gameId: gameInstance._id,
              day: gameInstance.day,
              stage: 2,
              action: 'kill'
            })
            const targetPlayer = killAction ? await getTargetPlayer(killAction.to) : null
            if(targetPlayer){
              await saveActionIfNeeded(actor, targetPlayer, 'antidote')
              results.push({ aiId: actor.username, success: true, action: 'antidote', target: targetPlayer.username })
            }
          } else if(decision.skillType === 'poison'){
            const targetPlayer = await getTargetPlayer(decision.skillTarget)
            if(targetPlayer){
              await saveActionIfNeeded(actor, targetPlayer, 'poison')
              results.push({ aiId: actor.username, success: true, action: 'poison', target: targetPlayer.username })
            }
          }
          continue
        }

        // 处理狼人夜间行动的特殊逻辑
        if(actionName === 'assault' && actor.role === 'wolf'){
          const privateVision = await buildPrivateVision(actor)
          
          // 如果是建议模式，保存AI建议而不是执行行动
          if(privateVision.wolfDecisionMode === 'advice_only'){
            // 保存AI建议到记录表，供真人狼人查看
            const { record } = $model
            await $service.baseService.save(record, {
              roomId: gameInstance.roomId,
              gameId: gameInstance._id,
              day: gameInstance.day,
              stage: gameInstance.stage,
              view: ['wolf'], // 只对狼人可见
              isCommon: 0,
              isTitle: 0,
              content: {
                type: 'wolf_advice',
                source: 'ai',
                aiId: actor.username,
                aiName: actor.name,
                speechText: decision.speechText || '',
                explain: decision.explain || [],
                suggestedTarget: decision.skillTarget,
                passReason: decision.passReason || '',
                confidence: decision.confidence || 0
              }
            })
            
            results.push({ 
              aiId: actor.username, 
              success: true, 
              action: 'wolf_advice', 
              suggestedTarget: decision.skillTarget,
              advice: decision.speechText,
              mode: 'advice_only'
            })
            continue
          }
        }
        
        const targetKey = actionName === 'vote' ? decision.voteTarget : decision.skillTarget
        const targetPlayer = await getTargetPlayer(targetKey)
        if(!targetPlayer){
          results.push({ aiId: actor.username, success: false, error: 'target not found' })
          continue
        }
        await saveActionIfNeeded(actor, targetPlayer, actionName)
        if(actionName === 'check'){
          const v = await $service.baseService.queryOne(vision, {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            from: actor.username,
            to: targetPlayer.username
          })
          if(v){
            await $service.baseService.updateById(vision, v._id, { status: 1 })
          }
        }
        results.push({ aiId: actor.username, success: true, action: actionName, target: targetPlayer.username })
      }
      return $helper.wrapResult(true, results)
    },

    async shouldAutoAdvanceStage(gameInstance) {
      const { $service, $helper, $model } = app
      const { player, action } = $model
      if(!gameInstance || gameInstance.status !== 1){
        return $helper.wrapResult(true, false)
      }

      if(gameInstance.stage === 1){
        const predictor = await $service.baseService.queryOne(player, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          role: 'predictor'
        })
        if(!predictor || predictor.status === 0){
          return $helper.wrapResult(true, true)
        }
        if(!isAiId(predictor.username)){
          return $helper.wrapResult(true, false)
        }
        const checkAction = await $service.baseService.queryOne(action, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: 1,
          from: predictor.username,
          action: 'check'
        })
        return $helper.wrapResult(true, !!checkAction)
      }

      if(gameInstance.stage === 2){
        const wolves = await $service.baseService.query(player, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          role: 'wolf',
          status: 1
        })
        if(!wolves || wolves.length < 1){
          return $helper.wrapResult(true, true)
        }
        const allAi = wolves.every(item => isAiId(item.username))
        if(!allAi){
          return $helper.wrapResult(true, false)
        }
        for(let i = 0; i < wolves.length; i++){
          const assaultAction = await $service.baseService.queryOne(action, {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: 2,
            from: wolves[i].username,
            action: 'assault'
          })
          if(!assaultAction){
            return $helper.wrapResult(true, false)
          }
        }
        return $helper.wrapResult(true, true)
      }

      if(gameInstance.stage === 3){
        const witch = await $service.baseService.queryOne(player, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          role: 'witch'
        })
        if(!witch || witch.status === 0){
          return $helper.wrapResult(true, true)
        }
        return $helper.wrapResult(true, isAiId(witch.username))
      }

      return $helper.wrapResult(true, false)
    },

    /**
     * 向AI服务发送公开事件
     * @param {Object} gameInstance 游戏实例
     * @param {Object} event 事件对象
     * @param {Array} candidateTargets 候选目标列表（可选）
     * @returns {Promise}
     */
    async sendPublicEvent(gameInstance, event, candidateTargets = null) {
      const { $helper } = app
      
      if (!gameInstance || !event) {
        return $helper.wrapResult(false, '游戏实例或事件不能为空', -1)
      }

      const requestData = {
        gameId: gameInstance._id,
        aiId: event.aiId || null, // 添加必需的aiId字段
        event: {
          day: event.day || gameInstance.day,
          stage: event.stage || gameInstance.stage,
          eventType: event.eventType,
          speaker: event.speaker,
          content: event.content,
          weight: event.weight || 1.0,
          targets: event.targets || []
        },
        asyncMode: true
      }

      if (candidateTargets && candidateTargets.length > 0) {
        requestData.candidateTargets = candidateTargets
      }

      return await post('/internal/ai/memory/event', requestData)
    }
  })
}
