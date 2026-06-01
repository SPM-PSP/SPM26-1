const axios = require('axios')

module.exports = app => {
  const fixMojibake = (value) => {
    if(typeof value !== 'string'){
      return value
    }
    const replacements = []
    let result = value
    replacements.forEach(([from, to]) => {
      result = result.split(from).join(to)
    })
    return result
  }

  const normalizeText = (value) => {
    if(Array.isArray(value)){
      return value.map(normalizeText)
    }
    if(value && typeof value === 'object'){
      const next = {}
      Object.keys(value).forEach(key => {
        next[key] = normalizeText(value[key])
      })
      return next
    }
    return fixMojibake(value)
  }

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
      witch: 'witch',        // 女巫角色映射，如果 AI 服务期望不同名称，可能需要调整为 'poisoner' 或 'witch'
      hunter: 'hunter',
      villager: 'villager'
    }
    return map[role] || role
  }

  const buildSeatContext = async (gameInstance, selfPlayer = null) => {
    const { $service, $model } = app
    const { player } = $model
    const players = await $service.baseService.query(player, {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id
    }, {}, { sort: { position: 1 } })

    const playerSeats = {}
    const playerDisplayNames = {}
    ;(players || []).forEach(item => {
      if(!item || !item.username){
        return
      }
      playerSeats[item.username] = item.position
      playerDisplayNames[item.username] = item.position + '号(' + (item.name || item.username) + ')'
    })

    return {
      selfSeat: selfPlayer ? selfPlayer.position : undefined,
      selfDisplayName: selfPlayer ? (selfPlayer.position + '号(' + (selfPlayer.name || selfPlayer.username) + ')') : undefined,
      playerSeats,
      playerDisplayNames
    }
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
      const { $service, $model } = app
      const { player } = $model
      const aiPlayer = await $service.baseService.queryOne(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        username: aiId
      })
      const seatContext = await buildSeatContext(gameInstance, aiPlayer)
      
      return await post('/internal/ai/agent/invoke', {
        requestId: params.requestId || ('req_' + gameInstance._id + '_' + aiId + '_' + Date.now()),
        gameId: String(gameInstance._id),
        aiId,
        stage: params.stage,
        role: aiPlayer ? toAiRole(aiPlayer.role) : undefined, // 娣诲姞瑙掕壊淇℃伅锛岃浆鎹负AI绔瘑鍒殑瑙掕壊鍚?        persona: params.persona || 'logical', // 娣诲姞persona
        selfSeat: params.selfSeat || seatContext.selfSeat,
        selfDisplayName: params.selfDisplayName || seatContext.selfDisplayName,
        playerSeats: params.playerSeats || seatContext.playerSeats,
        playerDisplayNames: params.playerDisplayNames || seatContext.playerDisplayNames,
        speechContext: params.speechContext,
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
      const stageNumber = Number(gameInstance.stage)
      const isSpeechStage = stageNumber === 5 || stageNumber === 7 || (stageNumber === 4 && Number(gameInstance.day) === 1)
      if(stageNumber === 5 || stageNumber === 7){
        const pendingPlaybackResult = await $service.gameService.getPendingAiSpeechPlayback(gameInstance)
        if(pendingPlaybackResult.result && pendingPlaybackResult.data){
          return $helper.wrapResult(true, [{
            success: true,
            action: 'wait_ai_speech_playback',
            recordId: pendingPlaybackResult.data._id
          }])
        }
      }
      let aiPlayers = await $service.baseService.query(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        username: { $like: 'ai_%' },
        status: 1
      }, {}, { sort: { position: 1 } })
      if((!aiPlayers || aiPlayers.length < 1) && !isSpeechStage){
        return $helper.wrapResult(true, [])
      }

      const alivePlayers = await $service.baseService.query(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        status: 1
      }, {}, { sort: { position: 1 } })
      const aliveIds = (alivePlayers || []).map(item => item.username)
      const allPlayers = await $service.baseService.query(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id
      }, {}, { sort: { position: 1 } })
      const playerSeats = {}
      const playerDisplayNames = {}
      ;(allPlayers || []).forEach(item => {
        if(!item || !item.username){
          return
        }
        playerSeats[item.username] = item.position
        playerDisplayNames[item.username] = item.position + '号(' + (item.name || item.username) + ')'
      })
      let currentSpeechLockKey = null
      let speechTurnState = null
      if(isSpeechStage){
        const turnResult = await $service.gameService.getSpeechTurnState(gameInstance)
        if(!turnResult.result || !turnResult.data || turnResult.data.finished || !turnResult.data.currentSpeaker){
          return $helper.wrapResult(true, [])
        }
        speechTurnState = turnResult.data
        if(!isAiId(turnResult.data.currentSpeaker.username)){
          return $helper.wrapResult(true, [])
        }
        const speechLockKey = [
          stageNumber === 7 ? 'ai-last-words' : 'ai-speech',
          gameInstance._id,
          gameInstance.day,
          turnResult.data.currentIndex,
          turnResult.data.currentSpeaker.username
        ].join('-')
        currentSpeechLockKey = speechLockKey
        if(app.$nodeCache.get(speechLockKey)){
          return $helper.wrapResult(true, [])
        }
        app.$nodeCache.set(speechLockKey, 1, 120)
        let currentAi = (aiPlayers || []).find(item => item.username === turnResult.data.currentSpeaker.username)
        if(!currentAi && isSpeechStage){
          currentAi = await $service.baseService.queryOne(player, {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            username: turnResult.data.currentSpeaker.username
          })
        }
        if(!currentAi){
          app.$nodeCache.del(speechLockKey)
          return $helper.wrapResult(true, [])
        }
        aiPlayers = [currentAi]
      }
      const speechContext = speechTurnState ? {
        round: gameInstance.day,
        starterId: speechTurnState.orderTag ? speechTurnState.orderTag.target : undefined,
        starterSeat: speechTurnState.orderTag ? playerSeats[speechTurnState.orderTag.target] : undefined,
        direction: speechTurnState.orderTag && String(speechTurnState.orderTag.value || '').trim() === 'desc' ? 'reverse' : 'forward',
        speechOrder: (speechTurnState.order || []).map(item => item.username),
        currentSpeakerId: speechTurnState.currentSpeaker ? speechTurnState.currentSpeaker.username : undefined,
        currentSpeakerSeat: speechTurnState.currentSpeaker ? speechTurnState.currentSpeaker.position : undefined,
        currentIndex: speechTurnState.currentIndex
      } : undefined
      const speechOrderIndex = {}
      if(speechContext && Array.isArray(speechContext.speechOrder)){
        speechContext.speechOrder.forEach((username, index) => {
          speechOrderIndex[username] = index
        })
      }
      const recentRecords = await $service.baseService.query(record, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        isCommon: 1
      }, {}, { sort: { _id: -1 }, limit: 20 })
      const visibleEvents = (recentRecords || []).reverse().map(item => {
        let speaker = undefined
        let speakerSeat = undefined
        let speakerDisplayName = undefined
        let orderIndex = undefined
        let isFirstSpeaker = undefined
        let content = ''
        if (item.content) {
          if ((item.content.type !== 'speech' && item.content.type !== 'lastWords') && item.content.text) {
            content = item.content.text
          } else if ((item.content.type === 'speech' || item.content.type === 'lastWords') && item.content.from) {
            const speakerInfo = {
              username: item.content.from.username,
              name: item.content.from.name,
              position: item.content.from.position
            }
            speaker = speakerInfo.username
            speakerSeat = speakerInfo.position || playerSeats[speaker]
            speakerDisplayName = playerDisplayNames[speaker] || (speakerSeat ? (speakerSeat + '号(' + (speakerInfo.name || speaker) + ')') : (speakerInfo.name || speaker))
            orderIndex = speechOrderIndex[speaker]
            isFirstSpeaker = orderIndex === 0
            content = speakerDisplayName + ': ' + (item.content.text || '')
          } else {
            // 瀵逛簬鍏朵粬绫诲瀷鐨勪簨浠讹紝鍙紶閫掗潪鏁忔劅淇℃伅
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
          content: content || JSON.stringify({}),
          speaker,
          speakerSeat,
          speakerDisplayName,
          orderIndex,
          isFirstSpeaker
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

        if((actionName === 'antidote' || actionName === 'poison') && Array.isArray(actor.skill)){
          const newSkillStatus = actor.skill.map(item => item.key === actionName ? {
              name: item.name,
              key: item.key,
              status: 0
            } : item)
          actor.skill = newSkillStatus
          await $service.baseService.updateById(player, actor._id, {
            skill: newSkillStatus
          })
        }
        
        if (actionName === 'vote') {
          try {
            const voteEvent = {
              day: gameInstance.day,
              stage: gameInstance.stage,
              eventType: 'vote',
              speaker: actor.username,
              speakerSeat: actor.position,
              speakerDisplayName: playerDisplayNames[actor.username],
              content: `投票给了${target.name}(${target.position}号)`,
              weight: 1.0,
              targets: [target.username]
            }
            
            const alivePlayers = await $service.baseService.query(player, {
              roomId: gameInstance.roomId,
              gameId: gameInstance._id,
              status: 1
            })
            const candidateTargets = alivePlayers.map(p => p.username)
            
            // 鑾峰彇鎵€鏈堿I鐜╁
            const aiPlayers = alivePlayers.filter(p => p.username.startsWith('ai_'))
            const aiIds = aiPlayers.map(p => p.username)
            
            // 浣跨敤骞挎挱鎺ュ彛鍙戦€佷簨浠剁粰鎵€鏈堿I
            await post('/internal/ai/game/events/broadcast', {
              gameId: String(gameInstance._id),
              event: voteEvent,
              aiIds: aiIds, // 鎸囧畾瑕佸彂閫佺殑AI鍒楄〃
              candidateTargets: candidateTargets,
              asyncMode: true
            })
          } catch (error) {
            if(app.$log4 && app.$log4.errorLogger){
              app.$log4.errorLogger.error('[AI Service] 发送AI投票事件失败: ' + error.toString())
            }
          }
        }
        
        return savedAction
      }

      const appendAiSpeech = async (actor, speechText, recordType = 'speech') => {
        if(!speechText){
          return null
        }
        let audioBase64 = ''
        let audioMime = ''
        let playbackRequired = false
        let ttsError = ''
        try {
          const audio = await $service.voiceService.ttsToBuffer(speechText)
          if(audio && audio.length > 0){
            audioBase64 = audio.toString('base64')
            audioMime = 'audio/mpeg'
            playbackRequired = true
          }
        } catch (error) {
          ttsError = error.message || error.toString()
          if(app.$log4 && app.$log4.errorLogger){
            app.$log4.errorLogger.error('[AI Service] AI发言TTS失败，降级为文本推进: ' + error.toString())
          }
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
            type: recordType,
            source: 'ai',
            text: speechText,
            audioBase64,
            audioMime,
            audioDataUrl: audioBase64 ? ('data:' + audioMime + ';base64,' + audioBase64) : '',
            playbackRequired,
            playbackStatus: playbackRequired ? 'pending' : 'skipped',
            speechTurnIndex: speechTurnState ? speechTurnState.currentIndex : undefined,
            ttsError,
            from: {
              username: actor.username,
              name: actor.name,
              position: actor.position
            }
          }
        })
        
        // 鍚慉I鏈嶅姟鍙戦€丄I鍙戣█浜嬩欢锛堜娇鐢ㄥ箍鎾帴鍙ｏ級
        try {
          const speechEvent = {
            day: gameInstance.day,
            stage: gameInstance.stage,
            eventType: recordType,
            speaker: actor.username,
            speakerSeat: actor.position,
            speakerDisplayName: playerDisplayNames[actor.username],
            orderIndex: speechOrderIndex[actor.username],
            isFirstSpeaker: speechOrderIndex[actor.username] === 0,
            content: speechText,
            weight: 1.0,
            targets: []
          }
          
          const alivePlayers = await $service.baseService.query(player, {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            status: 1
          })
          const candidateTargets = alivePlayers.map(p => p.username)
          
          // 鑾峰彇鎵€鏈堿I鐜╁
          const aiPlayers = alivePlayers.filter(p => p.username.startsWith('ai_'))
          const aiIds = aiPlayers.map(p => p.username)
          
          // 浣跨敤骞挎挱鎺ュ彛鍙戦€佷簨浠剁粰鎵€鏈堿I
          await post('/internal/ai/game/events/broadcast', {
            gameId: String(gameInstance._id),
            event: speechEvent,
            aiIds: aiIds, // 鎸囧畾瑕佸彂閫佺殑AI鍒楄〃
            candidateTargets: candidateTargets,
            asyncMode: true
          })
        } catch (error) {
          // AI鏈嶅姟璋冪敤澶辫触涓嶅奖鍝嶅彂瑷€鍔熻兘锛屽彧璁板綍鏃ュ織
          if(app.$log4 && app.$log4.errorLogger){
            app.$log4.errorLogger.error('[AI Service] 发送AI发言事件失败: ' + error.toString())
          }
        }
        
        return savedRecord
      }

      const scheduleAiSpeechPlaybackFallback = (savedRecord, speechText) => {
        if(!savedRecord || !savedRecord._id){
          return
        }
        const fallbackKey = 'ai-speech-playback-fallback-' + savedRecord._id
        if(app.$nodeCache.get(fallbackKey)){
          return
        }
        app.$nodeCache.set(fallbackKey, 1, 180)
        const textLength = String(speechText || '').length
        const delayMs = Math.min(45000, Math.max(8000, textLength * 180 + 3000))
        setTimeout(async () => {
          try {
            const latestGame = await $service.baseService.queryById($model.game, gameInstance._id)
            if(!latestGame || Number(latestGame.status) !== 1){
              return
            }
            if(Number(latestGame.stage) !== Number(gameInstance.stage) || Number(latestGame.day) !== Number(gameInstance.day)){
              return
            }
            const latestRecord = await $service.baseService.queryById(record, savedRecord._id)
            const latestContent = latestRecord && latestRecord.content ? latestRecord.content : null
            if(!latestContent || latestContent.playbackStatus !== 'pending'){
              return
            }
            await $service.gameService.completeAiSpeechPlayback(latestGame, savedRecord._id)
          } catch (error) {
            if(app.$log4 && app.$log4.errorLogger){
              app.$log4.errorLogger.error('[AI Service] AI发言播放兜底推进失败: ' + error.toString())
            }
          } finally {
            app.$nodeCache.del(fallbackKey)
          }
        }, delayMs)
      }

      const results = []
      const wolfPlayers = (alivePlayers || []).filter(item => item.role === 'wolf')
      const buildPrivateVision = async (actor) => {
        if(actor.role === 'wolf'){
          // 鐙间汉閫昏緫
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
          return {}
        } else if(actor.role === 'witch'){
          // 濂冲帆閫昏緫 - 鍙湪澶滈棿闃舵浼犻€抪rivateVision
          if(gameInstance.stage !== 3) {
            // 闈炲闂撮樁娈碉紝涓嶄紶閫掑コ宸殑privateVision淇℃伅
            return {}
          }
          
          const witchSkills = actor.skill || []
          const antidoteSkill = witchSkills.find(skill => skill.key === 'antidote')
          const poisonSkill = witchSkills.find(skill => skill.key === 'poison')
          
          const killActions = await $service.baseService.query(action, {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: 2,
            action: 'kill'
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
        } else if(stageNumber === 4 && speechTurnState){
          stageName = 'speech'
        } else if(gameInstance.stage === 5){
          stageName = 'speech'
        } else if(gameInstance.stage === 7){
          stageName = 'lastWords'
        } else if(gameInstance.stage === 6 || gameInstance.stage === 6.5){
          stageName = 'vote'
          actionName = 'vote'
        }

        if(!stageName){
          continue
        }

        const isLastWordsStage = stageName === 'lastWords'
        const privateVision = await buildPrivateVision(actor)
        const invokeResult = await this.invokeAgent(gameInstance, actor.username, {
          stage: isLastWordsStage ? 'speech' : stageName,
          speechContext,
          visibleEvents,
          alivePlayers: aliveIds,
          candidateTargets,
          privateVision: Object.assign({}, privateVision, {
            actualStage: isLastWordsStage ? 'lastWords' : stageName,
            isLastWords: isLastWordsStage
          }),
          asyncMode: false
        })
        if(!invokeResult.result){
          app.$log4.errorLogger.error('[aiService] invoke failed for ' + stageName + ': aiId=' + actor.username + ', error=' + invokeResult.errorMessage)
          if(currentSpeechLockKey){
            app.$nodeCache.del(currentSpeechLockKey)
          }
          results.push({ aiId: actor.username, success: false, error: invokeResult.errorMessage })
          continue
        }

        const decision = invokeResult.data && invokeResult.data.decision ? invokeResult.data.decision : {}
        if(stageName === 'speech' || stageName === 'lastWords'){
          const text = decision.speechText || decision.lastWords || decision.content || 'No further speech.'
          const recordType = (stageName === 'lastWords' || (speechTurnState && speechTurnState.currentSpeaker && speechTurnState.currentSpeaker.isFirstNightLastWords)) ? 'lastWords' : 'speech'
          const savedSpeechRecord = await appendAiSpeech(actor, text, recordType)
          app.$ws.connections.forEach(function (conn) {
            let url = '/lrs/' + gameInstance.roomId
            if(conn.path === url){
              conn.sendText('refreshGame')
              if(savedSpeechRecord && savedSpeechRecord.content && savedSpeechRecord.content.playbackRequired){
                conn.sendText(JSON.stringify({
                  type: 'aiSpeechReady',
                  roomId: gameInstance.roomId,
                  gameId: gameInstance._id,
                  recordId: savedSpeechRecord._id,
                  speechType: recordType,
                  speaker: {
                    username: actor.username,
                    name: actor.name,
                    position: actor.position
                  },
                  text,
                  audioBase64: savedSpeechRecord.content.audioBase64,
                  audioMime: savedSpeechRecord.content.audioMime,
                  audioDataUrl: savedSpeechRecord.content.audioDataUrl
                }))
              }
            }
          })
          if(savedSpeechRecord && savedSpeechRecord.content && savedSpeechRecord.content.playbackRequired){
            scheduleAiSpeechPlaybackFallback(savedSpeechRecord, text)
            results.push({
              aiId: actor.username,
              success: true,
              action: stageName,
              recordId: savedSpeechRecord._id,
              playbackRequired: true,
              waitingForPlaybackAck: true
            })
            continue
          }
          const advanceResult = await $service.gameService.advanceSpeechTurn(gameInstance, actor.username, speechTurnState ? speechTurnState.currentIndex : null)
          if(advanceResult.result){
            if(advanceResult.data.finished && stageName !== 'lastWords'){
              await $service.gameService.moveToNextStage(gameInstance._id)
            } else if(advanceResult.data.currentSpeaker && isAiId(advanceResult.data.currentSpeaker.username)){
              setImmediate(async () => {
                const latestGame = await $service.baseService.queryById($model.game, gameInstance._id)
                await $service.aiService.runAiForStage(latestGame)
              })
            }
          }
          results.push({ aiId: actor.username, success: true, action: stageName })
          continue
        }

        if(gameInstance.stage === 3 && actor.role === 'witch'){
          if(decision.skillType === 'antidote' || decision.skillType === 'save_and_poison'){
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
          }
          if(decision.skillType === 'poison' || decision.skillType === 'save_and_poison'){
            const poisonTarget = decision.skillTarget || (decision.nightAction && decision.nightAction.poisonTarget)
            const targetPlayer = await getTargetPlayer(poisonTarget)
            if(targetPlayer){
              await saveActionIfNeeded(actor, targetPlayer, 'poison')
              results.push({ aiId: actor.username, success: true, action: 'poison', target: targetPlayer.username })
            }
          }
          continue
        }

        // 澶勭悊鐙间汉澶滈棿琛屽姩鐨勭壒娈婇€昏緫
        if(actionName === 'assault' && actor.role === 'wolf'){
          const privateVision = await buildPrivateVision(actor)
          
          console.log('[aiService] AI狼人夜间行动调试信息:', {
            actor: actor.username,
            wolfDecisionMode: privateVision.wolfDecisionMode,
            allWolfPlayers: wolfPlayers.map(w => ({ username: w.username, isAI: isAiId(w.username) })),
            totalWolves: wolfPlayers.length,
            aiWolves: wolfPlayers.filter(w => isAiId(w.username)).length
          })
          
          // 鍏ˋI鐙间汉鍦烘櫙锛氫娇鐢╪ight-consensus鎺ュ彛
          if(!privateVision.wolfDecisionMode || privateVision.wolfDecisionMode === 'auto_execute'){
            // 妫€鏌ユ槸鍚︽墍鏈夌嫾浜洪兘鏄疉I
            const allWolfPlayers = wolfPlayers.filter(wolf => wolf.status === 1)
            const aiWolfPlayers = allWolfPlayers.filter(wolf => isAiId(wolf.username))
            
            // 濡傛灉鎵€鏈夌嫾浜洪兘鏄疉I锛屼娇鐢╪ight-consensus娴佺▼
            if(allWolfPlayers.length > 0 && allWolfPlayers.length === aiWolfPlayers.length){
              if(actor.username === aiWolfPlayers[0].username){
                try {
                  const consensusResult = await this.werewolfNightConsensus(
                    gameInstance, 
                    aiWolfPlayers.map(wolf => wolf.username),
                    {
                      visibleEvents,
                      candidateTargets,
                      privateVision: {
                        wolfTeammates: privateVision.wolfTeammates,
                        allowFriendlyFire: false
                      }
                    }
                  )
                  
                  if(consensusResult.result && consensusResult.data){
                    const consensusData = consensusResult.data
                    
                    // 浣跨敤鏂扮殑finalKillTarget鍜宔xecutionDecision瀛楁
                    const finalKillTarget = consensusData.finalKillTarget
                    const executionDecision = consensusData.executionDecision
                    
                    if(finalKillTarget && executionDecision){
                      // 鐩存帴浣跨敤AI绔繑鍥炵殑鏈€缁堝嚮鏉€鐩爣
                      const finalTargetPlayer = await getTargetPlayer(finalKillTarget)
                      
                      if(finalTargetPlayer){
                        // 涓烘墍鏈堿I鐙间汉淇濆瓨鍑绘潃琛屽姩
                        for(const wolfAi of aiWolfPlayers){
                          await saveActionIfNeeded(wolfAi, finalTargetPlayer, 'assault')
                          results.push({ 
                            aiId: wolfAi.username, 
                            success: true, 
                            action: 'assault', 
                            target: finalTargetPlayer.username,
                            consensusTarget: consensusData.consensusTarget,
                            finalKillTarget: finalKillTarget,
                            executionDecision: executionDecision,
                            mode: 'consensus_execute'
                          })
                        }
                      } else {
                        console.error('[aiService] finalKillTarget对应的玩家不存在:', finalKillTarget)
                        await fallbackToOldExecution(consensusData, aiWolfPlayers, results, getTargetPlayer, saveActionIfNeeded)
                      }
                    } else {
                      console.log('[aiService] night-consensus missing final fields, fallback to single AI execution')
                      await fallbackToOldExecution(consensusData, aiWolfPlayers, results, getTargetPlayer, saveActionIfNeeded)
                    }
                  } else {
                    // consensus澶辫触锛屽洖閫€鍒板崟涓狝I澶勭悊
                    console.log('[aiService] night-consensus失败，回退到单个AI处理:', consensusResult.errorMessage)
                  }

                  // 鏃х殑鎵ц鏂瑰紡浣滀负鍥為€€鏂规
                  const fallbackToOldExecution = async (consensusData, aiWolfPlayers, results, getTargetPlayer, saveActionIfNeeded) => {
                    for(const wolfAi of aiWolfPlayers){
                      const wolfPrivateVision = consensusData.privateVisionByAiId && consensusData.privateVisionByAiId[wolfAi.username] 
                        ? consensusData.privateVisionByAiId[wolfAi.username]
                        : consensusData.sharedPrivateVision
                      
                      const finalInvokeResult = await this.invokeAgent(gameInstance, wolfAi.username, {
                        stage: 'night_action',
                        visibleEvents,
                        alivePlayers: aliveIds,
                        candidateTargets,
                        privateVision: wolfPrivateVision,
                        asyncMode: false
                      })
                      
                      if(finalInvokeResult.result && finalInvokeResult.data && finalInvokeResult.data.decision){
                        const finalDecision = finalInvokeResult.data.decision
                        const finalTargetKey = finalDecision.skillTarget
                        const finalTargetPlayer = await getTargetPlayer(finalTargetKey)
                        
                        if(finalTargetPlayer){
                          await saveActionIfNeeded(wolfAi, finalTargetPlayer, 'assault')
                          results.push({ 
                            aiId: wolfAi.username, 
                            success: true, 
                            action: 'assault', 
                            target: finalTargetPlayer.username,
                            consensusTarget: consensusData.consensusTarget,
                            mode: 'consensus_execute_fallback'
                          })
                        } else {
                          results.push({ aiId: wolfAi.username, success: false, error: 'consensus target not found' })
                        }
                      } else {
                        results.push({ aiId: wolfAi.username, success: false, error: 'consensus execution failed' })
                      }
                    }
                  }
                } catch (error) {
                  console.log('[aiService] night-consensus异常，回退到单个AI处理:', error.toString())
                }
              }
              // 鍏朵粬AI鐙间汉璺宠繃澶勭悊锛岀瓑寰呯涓€涓狝I瀹屾垚consensus娴佺▼
              continue
            }
          }
          
          if(privateVision.wolfDecisionMode === 'advice_only'){
            // 淇濆瓨AI寤鸿鍒拌褰曡〃锛屼緵鐪熶汉鐙间汉鏌ョ湅
            const { record } = $model
            await $service.baseService.save(record, {
              roomId: gameInstance.roomId,
              gameId: gameInstance._id,
              day: gameInstance.day,
              stage: gameInstance.stage,
              view: ['wolf'], // 鍙鐙间汉鍙
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
        
        const targetKey = actionName === 'vote'
          ? (decision.voteTarget || decision.skillTarget || decision.target || decision.targetPlayer || (decision.vote && decision.vote.target))
          : (decision.skillTarget || decision.target || decision.targetPlayer)
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
          return $helper.wrapResult(true, false)
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
          return $helper.wrapResult(true, false)
        }
        return $helper.wrapResult(true, isAiId(witch.username))
      }

      if(gameInstance.stage === 6 || gameInstance.stage === 6.5){
        const voteStatusResult = await $service.gameService.getVoteStageStatus(gameInstance)
        if(!voteStatusResult.result || !voteStatusResult.data){
          return $helper.wrapResult(true, false)
        }
        return $helper.wrapResult(true, !!voteStatusResult.data.finished)
      }

      return $helper.wrapResult(true, false)
    },

    /**
     * 鍚慉I鏈嶅姟鍙戦€佸叕寮€浜嬩欢
     * @param {Object} gameInstance 娓告垙瀹炰緥
     * @param {Object} event 浜嬩欢瀵硅薄
     * @param {Array} candidateTargets 鍊欓€夌洰鏍囧垪琛紙鍙€夛級
     * @returns {Promise}
     */
    async werewolfNightConsensus(gameInstance, werewolfAiIds, params = {}) {
      const { $service, $helper, $model } = app
      const { player } = $model
      
      const alivePlayers = await $service.baseService.query(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        status: 1
      })
      const aliveIds = alivePlayers.map(item => item.username)
      
      // 鑾峰彇鐙间汉鐜╁淇℃伅
      const wolfPlayers = alivePlayers.filter(item => item.role === 'wolf')
      const wolfTeammates = wolfPlayers.map(wolf => wolf.username)
      const seatContext = await buildSeatContext(gameInstance)
      
      return await post('/internal/ai/werewolf/night-consensus', {
        requestId: params.requestId || ('req_wolf_consensus_' + gameInstance._id + '_' + Date.now()),
        gameId: String(gameInstance._id),
        werewolfAiIds: werewolfAiIds,
        playerSeats: params.playerSeats || seatContext.playerSeats,
        playerDisplayNames: params.playerDisplayNames || seatContext.playerDisplayNames,
        visibleEvents: params.visibleEvents || [],
        alivePlayers: aliveIds,
        candidateTargets: params.candidateTargets || aliveIds.filter(id => !wolfTeammates.includes(id)),
        privateVision: {
          wolfTeammates: wolfTeammates,
          allowFriendlyFire: params.allowFriendlyFire || false,
          ...params.privateVision
        }
      })
    },

    async sendPublicEvent(gameInstance, event, candidateTargets = null) {
      const { $helper } = app
      
      if (!gameInstance || !event) {
        return $helper.wrapResult(false, 'gameInstance or event is required', -1)
      }

      const requestData = {
        gameId: gameInstance._id,
        aiId: event.aiId || null, // 娣诲姞蹇呴渶鐨刟iId瀛楁
        event: {
          day: event.day || gameInstance.day,
          stage: event.stage || gameInstance.stage,
          eventType: event.eventType,
          speaker: event.speaker,
          speakerSeat: event.speakerSeat,
          speakerDisplayName: event.speakerDisplayName,
          orderIndex: event.orderIndex,
          isFirstSpeaker: event.isFirstSpeaker,
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
