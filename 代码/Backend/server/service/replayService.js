const axios = require('axios')

module.exports = app => {
  const getBaseUrl = () => {
    return process.env.AI_REPLAY_SERVICE_BASE_URL ||
      (app.$config.aiReplayService && app.$config.aiReplayService.baseUrl) ||
      'http://127.0.0.1:8002'
  }

  const getTimeout = () => {
    return (app.$config.aiReplayService && app.$config.aiReplayService.timeout) || 60000
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
      if (body.error) {
        return $helper.wrapResult(false, body.error, -1)
      }
      return $helper.wrapResult(true, body)
    } catch (e) {
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
      // 获取游戏基本信息
      const gameRecord = {
        game_id: gameInstance._id,
        room_id: gameInstance.roomId,
        start_time: gameInstance.createdAt || new Date().toISOString(),
        end_time: gameInstance.updatedAt || new Date().toISOString(),
        player_count: gameInstance.playerCount,
        mode: gameInstance.mode,
        winner: gameInstance.winner,
        days: gameInstance.day,
        final_result: {
          winner: gameInstance.winner === 1 ? '好人阵营' : gameInstance.winner === 2 ? '狼人阵营' : '未知',
          final_state: {}
        }
      }

      // 获取玩家最终状态
      const players = await $service.baseService.query(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id
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
        roomId: gameInstance.roomId,
        gameId: gameInstance._id
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
        roomId: gameInstance.roomId,
        gameId: gameInstance._id
      }, {}, { sort: { _id: 1 } })

      gameRecord.game_stats = {
        total_actions: actions.length,
        votes: actions.filter(a => a.action === 'vote').length,
        ability_uses: actions.filter(a => ['check', 'assault', 'antidote', 'poison', 'shoot'].includes(a.action)).length,
        total_deaths: players.filter(p => p.status === 0).length
      }

      // 按回合整理记录
      gameRecord.round_records = []
      for (let day = 1; day <= gameInstance.day; day++) {
        const dayRecords = records.filter(r => r.day === day)
        const dayActions = actions.filter(a => a.day === day)
        
        // 统计投票
        const voteActions = dayActions.filter(a => a.action === 'vote')
        const voteCounts = {}
        voteActions.forEach(v => {
          voteCounts[v.to] = (voteCounts[v.to] || 0) + 1
        })
        
        // 找出被投出的玩家
        let votedOut = null
        let maxVotes = 0
        for (const [playerId, count] of Object.entries(voteCounts)) {
          if (count > maxVotes) {
            maxVotes = count
            votedOut = playerId
          }
        }

        gameRecord.round_records.push({
          day,
          records: dayRecords.map(r => r.content),
          vote_results: {
            vote_counts: voteCounts,
            voted_out: votedOut ? gameRecord.final_result.final_state.players[votedOut] : null
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
      // 生成游戏记录
      const gameRecord = await generateGameRecord(gameInstance)

      // 准备AI配置
      let aiConfig = null
      if (options.enableAI && process.env.OPENAI_API_KEY) {
        aiConfig = {
          api_key: process.env.OPENAI_API_KEY,
          model: options.aiModel || 'gpt-4',
          baseurl: options.aiBaseUrl || null
        }
      }

      // 调用AI复盘服务
      const requestData = {
        game_record: gameRecord,
        ai_config: aiConfig,
        output_dir: options.outputDir || 'replay_analysis',
        desensitize: options.desensitize !== false
      }

      const result = await post('/analyze', requestData)
      
      if (result.result) {
        return $helper.wrapResult(true, {
          game_record: gameRecord,
          analysis_files: result.result,
          timestamp: result.result.timestamp
        })
      } else {
        return result
      }
    } catch (error) {
      return $helper.wrapResult(false, '复盘分析失败: ' + error.message, -1)
    }
  }

  return {
    checkHealth,
    generateGameRecord,
    analyzeGame
  }
}
