const axios = require('axios')

module.exports = app => {
  const getBaseUrl = () => {
    return (app.$config.aiService && app.$config.aiService.baseUrl) ||
      process.env.AI_SERVICE_BASE_URL ||
      'http://127.0.0.1:8001'
  }

  const getTimeout = () => {
    return (app.$config.aiService && app.$config.aiService.timeout) || 12000
  }

  const post = async (path, data) => {
    const { $helper, $log4 } = app
    try {
      const res = await axios({
        method: 'post',
        url: getBaseUrl() + path,
        data,
        timeout: getTimeout(),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const body = res.data || {}
      if(body.code !== undefined && body.code !== 200){
        return $helper.wrapResult(false, body.message || 'ai service error', body.code)
      }
      return $helper.wrapResult(true, body.data === undefined ? body : body.data)
    } catch (e) {
      if($log4 && $log4.errorLogger){
        $log4.errorLogger.error('[aiService] post ' + path + ' failed: ' + e.toString())
      }
      return $helper.wrapResult(false, 'ai service unavailable: ' + e.message, -1)
    }
  }

  const isAiId = (username) => {
    return /^ai_\d+$/.test(username || '')
  }

  const toAiRole = (role) => {
    const map = {
      wolf: 'werewolf',
      predictor: 'seer',
      witch: 'witch',
      hunter: 'hunter',
      villager: 'villager'
    }
    return map[role] || role
  }

  return ({
    isAiId,

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
      return await post('/internal/ai/agent/invoke', {
        requestId: params.requestId || ('req_' + gameInstance._id + '_' + aiId + '_' + Date.now()),
        gameId: String(gameInstance._id),
        aiId,
        stage: params.stage,
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
      const aiPlayers = await $service.baseService.query(player, {
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
      const recentRecords = await $service.baseService.query(record, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        isCommon: 1
      }, {}, { sort: { _id: -1 }, limit: 20 })
      const visibleEvents = (recentRecords || []).reverse().map(item => ({
        day: item.day,
        stage: item.stage,
        eventType: item.content && item.content.type ? item.content.type : 'record',
        content: item.content && item.content.text ? item.content.text : JSON.stringify(item.content || {})
      }))

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
        if(!target){
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
        return await $service.baseService.save(action, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          from: actor.username,
          to: target.username,
          action: actionName
        })
      }

      const appendAiSpeech = async (actor, speechText) => {
        if(!speechText){
          return null
        }
        return await $service.baseService.save(record, {
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
              position: actor.position,
              role: actor.role,
              camp: actor.camp
            }
          }
        })
      }

      const results = []
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
          privateVision: {},
          asyncMode: false
        })
        if(!invokeResult.result){
          results.push({ aiId: actor.username, success: false, error: invokeResult.errorMessage })
          continue
        }

        const decision = invokeResult.data && invokeResult.data.decision ? invokeResult.data.decision : {}
        if(stageName === 'speech'){
          await appendAiSpeech(actor, decision.speechText)
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
    }
  })
}
