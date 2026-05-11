module.exports = app => ({
  /**
   * @api {post} /api/voice/stt/auth 语音转文字
   * @apiGroup 语音模块
   */
  async stt (ctx) {
    const { $service, $helper } = app
    try {
      const audioBuffer = $service.voiceService.getAudioBuffer(ctx)
      const result = await $service.voiceService.sttFromBuffer(audioBuffer)
      ctx.body = $helper.Result.success(result)
    } catch (e) {
      ctx.body = $helper.Result.fail(-1, e.message || '语音识别失败')
    }
  },

  /**
   * @api {post} /api/voice/tts/auth 文字转语音
   * @apiGroup 语音模块
   */
  async tts (ctx) {
    const { $service, $helper } = app
    const body = ctx.request.body || {}
    try {
      const audio = await $service.voiceService.ttsToBuffer(body.text, {
        speaker: body.speaker,
        sampleRate: body.sampleRate,
        speechRate: body.speechRate,
      })
      ctx.set('Content-Type', 'audio/mpeg')
      ctx.set('Content-Disposition', 'inline; filename="tts.mp3"')
      ctx.body = audio
    } catch (e) {
      ctx.status = 200
      ctx.body = $helper.Result.fail(-1, e.message || '语音合成失败')
    }
  },

  /**
   * @api {post} /api/voice/speech/auth 提交玩家语音发言
   * @apiGroup 语音模块
   */
  async speech (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { game, player, record } = $model
    const body = ctx.request.body || {}
    const { roomId, gameId } = body

    if(!roomId){
      ctx.body = $helper.Result.fail(-1, 'roomId不能为空！')
      return
    }
    if(!gameId){
      ctx.body = $helper.Result.fail(-1, 'gameId不能为空！')
      return
    }

    try {
      const gameInstance = await $service.baseService.queryById(game, gameId)
      if(!gameInstance){
        ctx.body = $helper.Result.fail(-1, '游戏不存在！')
        return
      }
      if(gameInstance.stage !== 5){
        ctx.body = $helper.Result.fail(-1, '当前不是发言阶段，不能提交语音发言')
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
      if(currentPlayer.status !== 1){
        ctx.body = $helper.Result.fail(-1, '出局玩家不能发言')
        return
      }
      const turnResult = await $service.gameService.getSpeechTurnState(gameInstance)
      if(!turnResult.result){
        ctx.body = $helper.Result.fail(turnResult.errorCode, turnResult.errorMessage)
        return
      }
      const currentSpeaker = turnResult.data && turnResult.data.currentSpeaker
      if(!currentSpeaker || currentSpeaker.username !== currentPlayer.username){
        const speakerText = currentSpeaker ? (currentSpeaker.position + '号玩家发言中') : '当前没有可发言玩家'
        ctx.body = $helper.Result.fail(-1, '还没有轮到你发言，当前是' + speakerText)
        return
      }

      const audioBuffer = $service.voiceService.getAudioBuffer(ctx)
      const sttResult = await $service.voiceService.sttFromBuffer(audioBuffer)
      const recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'speech',
          source: 'human',
          text: sttResult.text,
          level: 4,
          from: {
            username: currentPlayer.username,
            name: currentPlayer.name,
            position: currentPlayer.position
            // 移除 role 和 camp 信息，防止身份泄露
          }
        }
      }
      const savedRecord = await $service.baseService.save(record, recordObject)
      
      // 向AI服务发送发言事件（使用广播接口）
      try {
        const speechEvent = {
          day: gameInstance.day,
          stage: gameInstance.stage,
          eventType: 'speech',
          speaker: currentPlayer.username,
          content: sttResult.text,
          weight: 1.0,
          targets: [] // 发言通常没有特定目标，AI会自己分析内容
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
            event: speechEvent,
            aiIds: aiIds, // 指定要发送的AI列表
            candidateTargets: candidateTargets,
            asyncMode: true
          },
          timeout: 12000,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      } catch (error) {
        // AI服务调用失败不影响发言功能，只记录日志
        if(app.$log4 && app.$log4.errorLogger){
          app.$log4.errorLogger.error('[AI Service] 发送发言事件失败: ' + error.toString())
        }
      }
      
      const advanceResult = await $service.gameService.advanceSpeechTurn(gameInstance)

      $ws.connections.forEach(function (conn) {
        let url = '/lrs/' + gameInstance.roomId
        if(conn.path === url){
          conn.sendText('refreshGame')
        }
      })

      ctx.body = $helper.Result.success({
        text: sttResult.text,
        recordId: savedRecord._id,
        from: recordObject.content.from,
        nextSpeaker: advanceResult.result && advanceResult.data ? advanceResult.data.currentSpeaker : null
      })
      if(advanceResult.result && advanceResult.data){
        if(advanceResult.data.finished){
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
    } catch (e) {
      ctx.body = $helper.Result.fail(-1, e.message || '提交语音发言失败')
    }
  },
})
