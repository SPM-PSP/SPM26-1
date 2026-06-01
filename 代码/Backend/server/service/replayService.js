const axios = require('axios')
const fs = require('fs')
const path = require('path')

module.exports = app => {
  const replayJobs = new Map()
  const getReplayDir = (outputDir = 'replay_analysis') => path.resolve(outputDir)
  const getReplayIndexPath = (outputDir = 'replay_analysis') => path.join(getReplayDir(outputDir), 'replay_index.json')

  const normalizeFilePath = (filePath) => {
    if(!filePath){
      return filePath
    }
    return filePath.replace(/\\/g, '/')
  }

  const readReplayIndex = (outputDir = 'replay_analysis') => {
    const indexPath = getReplayIndexPath(outputDir)
    if(!fs.existsSync(indexPath)){
      return []
    }
    try {
      const raw = fs.readFileSync(indexPath, 'utf8')
        .replace(/^\uFEFF+/, '')
        .replace(/^(?:锘縖|锘?)+/, '')
      const data = JSON.parse(raw)
      return Array.isArray(data) ? data : []
    } catch (e) {
      if(app.$log4 && app.$log4.errorLogger){
        app.$log4.errorLogger.error('[replayService] read replay index failed: ' + e.toString())
      }
      return []
    }
  }

  const writeReplayIndex = (items, outputDir = 'replay_analysis') => {
    const replayDir = getReplayDir(outputDir)
    if(!fs.existsSync(replayDir)){
      fs.mkdirSync(replayDir, { recursive: true })
    }
    fs.writeFileSync(getReplayIndexPath(outputDir), JSON.stringify(items, null, 2), 'utf8')
  }

  const getPlayersFromGameRecord = (gameRecord) => {
    const players = gameRecord &&
      gameRecord.final_result &&
      gameRecord.final_result.final_state &&
      gameRecord.final_result.final_state.players
    if(!players || typeof players !== 'object'){
      return []
    }
    return Object.keys(players).map(username => ({
      username,
      name: players[username].name,
      position: players[username].position,
      role: players[username].role,
      camp: players[username].camp,
      status: players[username].status,
      outReason: players[username].out_reason
    }))
  }

  const upsertReplayIndex = (gameRecord, analysisFiles, timestamp, outputDir = 'replay_analysis') => {
    if(!gameRecord || !gameRecord.game_id){
      return null
    }
    const items = readReplayIndex(outputDir)
    const gameId = String(gameRecord.game_id)
    const entry = {
      gameId: gameRecord.game_id,
      roomId: gameRecord.room_id,
      playerCount: gameRecord.player_count,
      mode: gameRecord.mode,
      winner: gameRecord.winner,
      winnerLabel: gameRecord.winner_label,
      days: gameRecord.days,
      startTime: gameRecord.start_time,
      endTime: gameRecord.end_time,
      timestamp: timestamp || new Date().toISOString(),
      analysisFiles: {
        json: normalizeFilePath(analysisFiles && analysisFiles.json),
        text: normalizeFilePath(analysisFiles && analysisFiles.text)
      },
      players: getPlayersFromGameRecord(gameRecord)
    }
    const nextItems = items.filter(item => String(item.gameId) !== gameId)
    nextItems.unshift(entry)
    writeReplayIndex(nextItems, outputDir)
    return entry
  }

  const getReplayIndexByGameId = (gameId, outputDir = 'replay_analysis') => {
    const items = readReplayIndex(outputDir)
    return items.find(item => String(item.gameId) === String(gameId)) || null
  }

  const hasAnalysisFiles = (analysisFiles) => {
    if(!analysisFiles || !analysisFiles.json || !analysisFiles.text){
      return false
    }
    return fs.existsSync(path.resolve(analysisFiles.json)) && fs.existsSync(path.resolve(analysisFiles.text))
  }

  const findGeneratedAnalysisFilesSince = (outputDir = 'replay_analysis', startedAt = 0) => {
    const replayDir = getReplayDir(outputDir)
    if(!fs.existsSync(replayDir)){
      return null
    }
    const threshold = Math.max(0, Number(startedAt || 0) - 5000)
    const jsonFiles = fs.readdirSync(replayDir)
      .filter(name => /^ai_replay_\d{8}_\d{6}\.json$/.test(name))
      .map(name => {
        const fullPath = path.join(replayDir, name)
        return {
          name,
          fullPath,
          mtimeMs: fs.statSync(fullPath).mtimeMs,
          stamp: name.replace(/^ai_replay_/, '').replace(/\.json$/, '')
        }
      })
      .filter(item => item.mtimeMs >= threshold)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)

    for(let i = 0; i < jsonFiles.length; i++){
      const jsonFile = jsonFiles[i]
      const textName = 'ai_replay_' + jsonFile.stamp + '.txt'
      const textPath = path.join(replayDir, textName)
      if(fs.existsSync(textPath)){
        return {
          json: normalizeFilePath(path.join(outputDir, jsonFile.name)),
          text: normalizeFilePath(path.join(outputDir, textName)),
          timestamp: new Date(jsonFile.mtimeMs).toISOString(),
          recovered: true
        }
      }
    }
    return null
  }

  const getReplayAnalysisContent = (analysisFiles) => {
    const content = {}
    if(!analysisFiles){
      return content
    }
    const allowedDir = getReplayDir()
    ;['json', 'text'].forEach(type => {
      const file = analysisFiles[type]
      if(!file){
        return
      }
      const filePath = path.resolve(file)
      if(!filePath.startsWith(allowedDir) || !fs.existsSync(filePath)){
        return
      }
      const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF+/, '')
      content[type] = type === 'json' ? JSON.parse(raw) : raw
    })
    return content
  }

  const getBaseUrl = () => {
    return process.env.AI_REPLAY_SERVICE_BASE_URL ||
      (app.$config.aiReplayService && app.$config.aiReplayService.baseUrl) ||
      'http://127.0.0.1:8002'
  }

  const getTimeout = () => {
    return (app.$config.aiReplayService && app.$config.aiReplayService.timeout) || 180000
  }

  const getAiConfig = (options = {}) => {
    const replayModel = app.$config.aiReplayModel || {}
    const apiKey = replayModel.apiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
      return null
    }

    return {
      api_key: apiKey,
      model: options.aiModel || replayModel.model || process.env.OPENAI_MODEL || 'gpt-4',
      baseurl: options.aiBaseUrl || replayModel.baseUrl || process.env.OPENAI_BASE_URL || null
    }
  }

  const post = async (path, data) => {
    const { $helper, $log4 } = app
    const url = getBaseUrl() + path
    const timeout = getTimeout()
    const payloadSize = data ? Buffer.byteLength(JSON.stringify(data), 'utf8') : 0
    try {
      console.log('[replayService] POST ' + url + ', timeout=' + timeout + 'ms, payload=' + payloadSize + ' bytes')
      const res = await axios({
        method: 'post',
        url,
        data,
        timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      console.log('[replayService] POST ' + url + ' success, status=' + res.status)
      const body = res.data || {}
      if (body.error) {
        return $helper.wrapResult(false, body.error, -1)
      }
      return $helper.wrapResult(true, body)
    } catch (e) {
      console.log('[replayService] POST ' + url + ' failed: ' + e.message)
      if($log4 && $log4.errorLogger){
        $log4.errorLogger.error('[replayService] post ' + path + ' failed: ' + e.toString())
      }
      return $helper.wrapResult(false, 'AI复盘服务不可用: ' + e.message, -1)
    }
  }

  /**
   * 检查AI复盘服务健康状态
   */
  const checkHealth = async () => {
    const { $helper } = app
    try {
      const res = await axios.get(getBaseUrl() + '/health', { timeout: 5000 })
      return $helper.wrapResult(true, res.data)
    } catch (e) {
      return $helper.wrapResult(false, 'AI复盘服务不可用: ' + e.message, -1)
    }
  }

  /**
   * 生成游戏记录数据
   * @param {Object} gameInstance 游戏实例
   * @returns {Object} 游戏记录数据
   */
  const generateGameRecord = async (gameInstance) => {
    const { $service, $model } = app
    const { game, player, record, action, gameTag } = $model

    try {
      const gameIdValue = gameInstance._id || gameInstance.id
      const roomIdValue = gameInstance.roomId || gameInstance.room_id
      // 获取游戏基本信息
      const winnerLabel = gameInstance.winner === 1 ? '好人阵营' : gameInstance.winner === 0 ? '狼人阵营' : '未知'
      const gameRecord = {
        game_id: gameIdValue,
        room_id: roomIdValue,
        start_time: gameInstance.createdAt || new Date().toISOString(),
        end_time: gameInstance.updatedAt || new Date().toISOString(),
        player_count: gameInstance.playerCount,
        mode: gameInstance.mode,
        winner: gameInstance.winner,
        winner_label: winnerLabel,
        days: gameInstance.day,
        final_result: {
          winner: winnerLabel,
          final_state: {}
        }
      }

      // 获取玩家最终状态
      const players = await $service.baseService.query(player, {
        roomId: roomIdValue,
        gameId: gameIdValue
      })

      gameRecord.final_result.final_state.players = {}
      players.forEach(p => {
        gameRecord.final_result.final_state.players[p.username] = {
          name: p.name,
          position: p.position,
          role: p.role,
          camp: p.camp,
          status: p.status === 1 ? 'alive' : 'dead',
          out_reason: p.outReason || 'unknown'
        }
      })

      // 获取游戏事件记录
      const records = await $service.baseService.query(record, {
        roomId: roomIdValue,
        gameId: gameIdValue
      }, {}, { sort: { _id: 1 } })

      gameRecord.events = []
      records.forEach(r => {
        if (r.content && r.content.type) {
          gameRecord.events.push({
            day: r.day,
            stage: r.stage,
            type: r.content.type,
            timestamp: r.createdAt,
            data: r.content
          })
        }
      })

      // 获取投票记录
      const actions = await $service.baseService.query(action, {
        roomId: roomIdValue,
        gameId: gameIdValue
      }, {}, { sort: { _id: 1 } })

      gameRecord.game_stats = {
        total_actions: actions.length,
        votes: actions.filter(a => a.action === 'vote').length,
        ability_uses: actions.filter(a => ['check', 'assault', 'antidote', 'poison', 'shoot'].includes(a.action)).length,
        total_deaths: players.filter(p => p.status === 0).length
      }

      const playerProfileMap = {}
      players.forEach(p => {
        playerProfileMap[p.username] = {
          username: p.username,
          name: p.name,
          position: p.position,
          role: p.role,
          camp: p.camp,
          status: p.status === 1 ? 'alive' : 'dead',
          out_reason: p.outReason || 'unknown'
        }
      })

      const getProfile = (username) => username && playerProfileMap[username] ? playerProfileMap[username] : null
      const getRecordText = (content) => {
        if(!content){
          return ''
        }
        if(content.text){
          return content.text
        }
        if(Array.isArray(content.content)){
          return content.content.map(item => item && item.text ? item.text : '').join('')
        }
        return ''
      }

      gameRecord.vote_records = actions
        .filter(a => a.action === 'vote')
        .map(a => ({
          day: a.day,
          stage: a.stage,
          actor: getProfile(a.from),
          target: getProfile(a.to),
          target_name: getProfile(a.to) ? getProfile(a.to).name : a.to,
          vote_phase: a.stage === 6.5 ? 'pk' : 'normal'
        }))

      gameRecord.player_logs = {}
      players.forEach(p => {
        gameRecord.player_logs[p.username] = {
          profile: playerProfileMap[p.username],
          speeches: [],
          actions: [],
          votes_cast: [],
          votes_received: []
        }
      })

      records.forEach(r => {
        const content = r.content || {}
        if((content.type === 'speech' || content.type === 'lastWords') && content.from && content.from.username){
          const log = gameRecord.player_logs[content.from.username]
          if(log){
            log.speeches.push({
              day: r.day,
              stage: r.stage,
              type: content.type,
              text: getRecordText(content)
            })
          }
        }
      })

      actions.forEach(a => {
        const actorLog = gameRecord.player_logs[a.from]
        const targetProfile = getProfile(a.to)
        if(actorLog){
          const actionItem = {
            day: a.day,
            stage: a.stage,
            action: a.action,
            target: targetProfile,
            target_name: targetProfile ? targetProfile.name : a.to
          }
          if(a.action === 'vote'){
            actorLog.votes_cast.push(actionItem)
          } else {
            actorLog.actions.push(actionItem)
          }
        }
        if(a.action === 'vote'){
          const targetLog = gameRecord.player_logs[a.to]
          if(targetLog){
            targetLog.votes_received.push({
              day: a.day,
              stage: a.stage,
              actor: getProfile(a.from)
            })
          }
        }
      })

      // 按回合整理记录
      gameRecord.round_records = []
      for (let day = 1; day <= gameInstance.day; day++) {
        const dayRecords = records.filter(r => r.day === day)
        const dayActions = actions.filter(a => a.day === day)
        const daySpeeches = dayRecords
          .filter(r => r.content && (r.content.type === 'speech' || r.content.type === 'lastWords'))
          .map(r => ({
            day: r.day,
            stage: r.stage,
            type: r.content.type,
            actor: r.content.from ? getProfile(r.content.from.username) || r.content.from : null,
            text: getRecordText(r.content)
          }))
        const dayActionSamples = dayActions.map(a => ({
          day: a.day,
          stage: a.stage,
          action: a.action,
          actor: getProfile(a.from),
          target: getProfile(a.to),
          target_name: getProfile(a.to) ? getProfile(a.to).name : a.to
        }))
        
        // 统计投票
        const voteActions = dayActions.filter(a => a.action === 'vote')
        const voteCounts = {}
        const voteCountsByName = {}
        voteActions.forEach(v => {
          voteCounts[v.to] = (voteCounts[v.to] || 0) + 1
          const targetProfile = getProfile(v.to)
          const targetName = targetProfile && targetProfile.name ? targetProfile.name : v.to
          voteCountsByName[targetName] = (voteCountsByName[targetName] || 0) + 1
        })
        
        // 优先使用真实放逐记录。不能只按最高票推断，否则平票也会被误写成出局。
        const outRecord = dayRecords.find(r => {
          const content = r.content || {}
          return content.action === 'out' || content.actionName === '放逐'
        })
        let votedOut = outRecord && outRecord.content && outRecord.content.from
          ? outRecord.content.from.username
          : null
        if(!votedOut){
          let maxVotes = 0
          let topPlayers = []
          for (const [playerId, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
              maxVotes = count
              topPlayers = [playerId]
            } else if (count === maxVotes) {
              topPlayers.push(playerId)
            }
          }
          votedOut = topPlayers.length === 1 ? topPlayers[0] : null
        }
        const votedOutInfo = votedOut ? gameRecord.final_result.final_state.players[votedOut] : null

        gameRecord.round_records.push({
          day,
          records: dayRecords.map(r => r.content),
          speeches: daySpeeches,
          actions: dayActionSamples,
          votes: dayActionSamples.filter(item => item.action === 'vote'),
          vote_results: {
            vote_counts: voteCounts,
            vote_counts_by_name: voteCountsByName,
            voted_out: votedOutInfo,
            voted_out_name: votedOutInfo ? ((votedOutInfo.position || '') + '号' + (votedOutInfo.name ? '（' + votedOutInfo.name + '）' : '')) : null,
            voted_out_display: votedOutInfo ? ((votedOutInfo.name || votedOut) + '（' + ((votedOutInfo.role && ({ wolf: '狼人', predictor: '预言家', witch: '女巫', hunter: '猎人', villager: '平民' })[votedOutInfo.role]) || votedOutInfo.role || '未知身份') + '）') : '无玩家出局'
          }
        })
      }

      return gameRecord
    } catch (error) {
      if(app.$log4 && app.$log4.errorLogger){
        app.$log4.errorLogger.error('[replayService] 生成游戏记录失败: ' + error.toString())
      }
      throw error
    }
  }

  /**
   * 分析游戏复盘
   * @param {Object} gameInstance 游戏实例
   * @param {Object} options 选项
   * @returns {Promise}
   */
  const analyzeGame = async (gameInstance, options = {}) => {
    const { $helper } = app

    if (!gameInstance) {
      return $helper.wrapResult(false, '游戏实例不能为空', -1)
    }

    try {
      const gameId = String(gameInstance._id || gameInstance.id)
      const outputDir = options.outputDir || 'replay_analysis'

      const existingReplay = getReplayIndexByGameId(gameId, outputDir)
      if(existingReplay && options.force !== true && hasAnalysisFiles(existingReplay.analysisFiles)){
        return $helper.wrapResult(true, {
          game_record: null,
          analysis_files: existingReplay.analysisFiles,
          replay_index: existingReplay,
          timestamp: existingReplay.timestamp,
          reused: true
        })
      }

      if(replayJobs.has(gameId) && options.force !== true){
        return replayJobs.get(gameId)
      }

      const jobPromise = (async () => {
        const gameRecord = await generateGameRecord(gameInstance)

        // 准备AI配置
        const aiConfig = options.enableAI ? getAiConfig(options) : null

        // 调用AI复盘服务
        const requestData = {
          game_record: gameRecord,
          ai_config: aiConfig,
          output_dir: outputDir,
          desensitize: options.desensitize !== false
        }

        const startedAt = Date.now()
        const result = await post('/analyze', requestData)

        if (result.result) {
          const analysisData = result.data || {}
          const analysisFiles = analysisData.result
          const replayIndex = upsertReplayIndex(
            gameRecord,
            analysisFiles,
            analysisData.timestamp,
            outputDir
          )
          if(!replayIndex){
            return $helper.wrapResult(false, '复盘文件已生成，但索引写入失败：game_id为空', -1)
          }
          return $helper.wrapResult(true, {
            game_record: gameRecord,
            analysis_files: analysisFiles,
            replay_index: replayIndex,
            timestamp: analysisData.timestamp
          })
        } else {
          const recoveredFiles = findGeneratedAnalysisFilesSince(outputDir, startedAt)
          if(recoveredFiles){
            const replayIndex = upsertReplayIndex(
              gameRecord,
              recoveredFiles,
              recoveredFiles.timestamp,
              outputDir
            )
            if(!replayIndex){
              return $helper.wrapResult(false, '复盘文件已恢复，但索引写入失败：game_id为空', -1)
            }
            return $helper.wrapResult(true, {
              game_record: gameRecord,
              analysis_files: recoveredFiles,
              replay_index: replayIndex,
              timestamp: recoveredFiles.timestamp,
              recovered: true
            })
          }
          return result
        }
      })()

      replayJobs.set(gameId, jobPromise)
      const jobResult = await jobPromise
      return jobResult
    } catch (error) {
      return $helper.wrapResult(false, '复盘分析失败: ' + error.message, -1)
    } finally {
      const gameId = String(gameInstance._id || gameInstance.id)
      replayJobs.delete(gameId)
    }
  }

  const ensureGameReplay = async (gameInstance, options = {}) => {
    const { $helper } = app
    if(!gameInstance || (!gameInstance._id && !gameInstance.id)){
      return $helper.wrapResult(false, 'gameInstance为空', -1)
    }

    const gameId = String(gameInstance._id || gameInstance.id)
    const outputDir = options.outputDir || 'replay_analysis'
    const existingReplay = getReplayIndexByGameId(gameId, outputDir)
    if(existingReplay && hasAnalysisFiles(existingReplay.analysisFiles)){
      console.log('[ReplayAuto] skip existing replay, gameId=' + gameId)
      return $helper.wrapResult(true, {
        replay_index: existingReplay,
        reused: true
      })
    }

    if(replayJobs.has(gameId)){
      console.log('[ReplayAuto] skip running replay job, gameId=' + gameId)
      return replayJobs.get(gameId)
    }

    try {
      console.log('[ReplayAuto] start replay generation, gameId=' + gameId)
      const result = await analyzeGame(gameInstance, {
        enableAI: options.enableAI !== false,
        aiModel: options.aiModel,
        outputDir,
        desensitize: options.desensitize !== false,
        force: false
      })
      if(result.result){
        console.log('[ReplayAuto] success replay generation, gameId=' + gameId)
      } else {
        console.log('[ReplayAuto] failed replay generation, gameId=' + gameId + ', error=' + result.errorMessage)
      }
      return result
    } catch (e) {
      console.log('[ReplayAuto] failed replay generation, gameId=' + gameId + ', error=' + e.message)
      return $helper.wrapResult(false, '自动生成复盘失败: ' + e.message, -1)
    } finally {
      replayJobs.delete(gameId)
    }
  }

  const triggerGameReplay = (gameInstance, options = {}) => {
    const gameId = gameInstance && gameInstance._id
    setImmediate(async () => {
      try {
        await ensureGameReplay(gameInstance, options)
      } catch (e) {
        console.log('[ReplayAuto] unexpected error, gameId=' + gameId + ', error=' + e.message)
      }
    })
  }

  return {
    checkHealth,
    generateGameRecord,
    analyzeGame,
    ensureGameReplay,
    triggerGameReplay,
    readReplayIndex,
    getReplayIndexByGameId,
    getReplayAnalysisContent,
    findGeneratedAnalysisFilesSince
  }
}
