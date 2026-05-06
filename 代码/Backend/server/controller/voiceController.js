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
            position: currentPlayer.position,
            role: currentPlayer.role,
            camp: currentPlayer.camp
          }
        }
      }
      const savedRecord = await $service.baseService.save(record, recordObject)
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
