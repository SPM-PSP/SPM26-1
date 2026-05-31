module.exports = app => ({
  async stt (ctx) {
    const { $service, $helper } = app
    try {
      const audioBuffer = $service.voiceService.getAudioBuffer(ctx)
      const result = await $service.voiceService.sttFromBuffer(audioBuffer)
      ctx.body = $helper.Result.success(result)
    } catch (e) {
      ctx.body = $helper.Result.fail(-1, e.message || 'speech recognition failed')
    }
  },

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
      ctx.body = $helper.Result.fail(-1, e.message || 'speech synthesis failed')
    }
  },

  async speech (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { game, player, record } = $model
    const body = ctx.request.body || {}
    const { roomId, gameId } = body

    if(!roomId){
      ctx.body = $helper.Result.fail(-1, 'roomId is required')
      return
    }
    if(!gameId){
      ctx.body = $helper.Result.fail(-1, 'gameId is required')
      return
    }

    try {
      const gameInstance = await $service.baseService.queryById(game, gameId)
      if(!gameInstance){
        ctx.body = $helper.Result.fail(-1, 'game not found')
        return
      }
      if(gameInstance.stage !== 5){
        ctx.body = $helper.Result.fail(-1, 'current stage does not allow speech')
        return
      }

      const currentUser = await $service.baseService.userInfo(ctx)
      const currentPlayer = await $service.baseService.queryOne(player, {
        roomId,
        gameId,
        username: currentUser.username
      })
      if(!currentPlayer){
        ctx.body = $helper.Result.fail(-1, 'player not found in this game')
        return
      }

      const turnResult = await $service.gameService.getSpeechTurnState(gameInstance)
      if(!turnResult.result){
        ctx.body = $helper.Result.fail(turnResult.errorCode, turnResult.errorMessage)
        return
      }
      const currentSpeaker = turnResult.data && turnResult.data.currentSpeaker
      const isFirstNightLastWords = !!(currentSpeaker && currentSpeaker.isFirstNightLastWords)
      if(currentPlayer.status !== 1 && !isFirstNightLastWords){
        ctx.body = $helper.Result.fail(-1, 'eliminated players cannot speak')
        return
      }
      if(!currentSpeaker || currentSpeaker.username !== currentPlayer.username){
        const speakerText = currentSpeaker ? (currentSpeaker.position + ' seat player is speaking') : 'no current speaker'
        ctx.body = $helper.Result.fail(-1, 'not your speech turn, current speaker is ' + speakerText)
        return
      }

      const speechText = (body.text || body.content || '').trim()
      const sttResult = speechText
        ? { text: speechText }
        : await $service.voiceService.sttFromBuffer($service.voiceService.getAudioBuffer(ctx))

      const recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: isFirstNightLastWords ? 'lastWords' : 'speech',
          source: 'human',
          text: sttResult.text,
          level: 4,
          from: {
            username: currentPlayer.username,
            name: currentPlayer.name,
            position: currentPlayer.position
          }
        }
      }
      const savedRecord = await $service.baseService.save(record, recordObject)

      try {
        const speechEvent = {
          day: gameInstance.day,
          stage: gameInstance.stage,
            eventType: isFirstNightLastWords ? 'lastWords' : 'speech',
          speaker: currentPlayer.username,
          speakerSeat: currentPlayer.position,
          speakerDisplayName: currentPlayer.position + '号(' + (currentPlayer.name || currentPlayer.username) + ')',
          content: sttResult.text,
          weight: 1.0,
          targets: []
        }

        const alivePlayers = await $service.baseService.query(player, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          status: 1
        })
        const candidateTargets = alivePlayers.map(p => p.username)
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
              event: speechEvent,
              aiIds,
              candidateTargets,
              asyncMode: true
            },
            timeout: 12000,
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }
      } catch (error) {
        if(app.$log4 && app.$log4.errorLogger){
          app.$log4.errorLogger.error('[AI Service] send speech event failed: ' + error.toString())
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
      ctx.body = $helper.Result.fail(-1, e.message || 'submit speech failed')
    }
  },

  async aiSpeechPlayed (ctx) {
    const { $service, $helper, $model } = app
    const { game } = $model
    const body = ctx.request.body || {}
    const { gameId, recordId } = body

    if(!gameId){
      ctx.body = $helper.Result.fail(-1, 'gameId is required')
      return
    }
    if(!recordId){
      ctx.body = $helper.Result.fail(-1, 'recordId is required')
      return
    }

    try {
      const gameInstance = await $service.baseService.queryById(game, gameId)
      if(!gameInstance){
        ctx.body = $helper.Result.fail(-1, 'game not found')
        return
      }
      const result = await $service.gameService.completeAiSpeechPlayback(gameInstance, recordId)
      if(!result.result){
        ctx.body = $helper.Result.fail(result.errorCode || -1, result.errorMessage || 'confirm ai speech playback failed')
        return
      }
      ctx.body = $helper.Result.success({
        recordId,
        nextSpeaker: result.data ? result.data.currentSpeaker : null,
        finished: result.data ? !!result.data.finished : false
      })
    } catch (e) {
      ctx.body = $helper.Result.fail(-1, e.message || 'confirm ai speech playback failed')
    }
  },
})
