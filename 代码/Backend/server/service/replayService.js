const axios = require('axios')
const fs = require('fs')
const path = require('path')

const STAGE_META = {
  1: { name: 'night_check', label: 'predictor_check', phase: 'night' },
  2: { name: 'night_assault', label: 'wolf_assault', phase: 'night' },
  3: { name: 'night_witch', label: 'witch_action', phase: 'night' },
  4: { name: 'day_result', label: 'day_result', phase: 'day' },
  5: { name: 'day_speech', label: 'speech', phase: 'day' },
  6: { name: 'day_vote', label: 'vote', phase: 'day' },
  6.5: { name: 'day_pk_vote', label: 'pk_vote', phase: 'day' },
  7: { name: 'day_resolution', label: 'resolution', phase: 'day' }
}

const ABILITY_ACTIONS = ['check', 'assault', 'kill', 'antidote', 'poison', 'shoot', 'self_destruct']

const loadEnvFile = () => {
  const envPath = path.resolve(__dirname, '..', '..', '.env')
  if (!fs.existsSync(envPath)) {
    return
  }

  const content = fs.readFileSync(envPath, 'utf8')
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      return
    }

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex < 0) {
      return
    }

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  })
}

loadEnvFile()

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
      if ($log4 && $log4.errorLogger) {
        $log4.errorLogger.error('[replayService] post ' + path + ' failed: ' + e.toString())
      }
      return $helper.wrapResult(false, 'AI replay service request failed: ' + e.message, -1)
    }
  }

  const checkHealth = async () => {
    const { $helper } = app
    try {
      const res = await axios.get(getBaseUrl() + '/health', { timeout: 5000 })
      return $helper.wrapResult(true, res.data)
    } catch (e) {
      return $helper.wrapResult(false, 'AI replay service unavailable: ' + e.message, -1)
    }
  }

  const normalizeTimestamp = value => {
    if (!value) return null
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'string') return value
    try {
      return new Date(value).toISOString()
    } catch (e) {
      return null
    }
  }

  const cloneJson = value => {
    if (value === undefined) return undefined
    if (value === null) return null
    try {
      return JSON.parse(JSON.stringify(value))
    } catch (e) {
      return value
    }
  }

  const getStageMeta = stage => {
    return STAGE_META[stage] || {
      name: 'stage_' + String(stage),
      label: 'stage_' + String(stage),
      phase: Number(stage) < 4 ? 'night' : 'day'
    }
  }

  const getCampLabel = camp => {
    if (camp === 1) return 'good'
    if (camp === 0) return 'wolf'
    return 'unknown'
  }

  const getStatusLabel = status => {
    return status === 1 ? 'alive' : 'dead'
  }

  const getWinnerLabel = winner => {
    if (winner === 1) return 'good'
    if (winner === 0) return 'wolf'
    return 'unknown'
  }

  const buildOutputDir = (options = {}) => {
    return options.outputDir || 'replay_analysis'
  }

  const getReplayApiKey = () => {
    return process.env.REPLAY_AI_API_KEY || process.env.OPENAI_API_KEY || null
  }

  const getReplayModel = options => {
    return options.aiModel || process.env.REPLAY_AI_MODEL || 'gpt-4'
  }

  const getReplayBaseUrl = options => {
    return options.aiBaseUrl || process.env.REPLAY_AI_BASE_URL || null
  }

  const buildPlayerProfile = player => {
    if (!player) return null
    return {
      username: player.username || null,
      name: player.name || null,
      position: player.position || null,
      role: player.role || null,
      camp: player.camp,
      camp_label: getCampLabel(player.camp),
      status: player.status,
      status_label: getStatusLabel(player.status),
      out_reason: player.outReason || null,
      skill: cloneJson(player.skill || []),
      is_ai: typeof player.username === 'string' && player.username.startsWith('ai_')
    }
  }

  const buildEmbeddedPlayer = (value, playersByUsername) => {
    if (!value) return null
    if (typeof value === 'string') {
      const matched = playersByUsername[value]
      return matched ? buildPlayerProfile(matched) : { username: value }
    }

    const username = value.username || null
    const matched = username && playersByUsername[username] ? playersByUsername[username] : null
    const base = matched ? buildPlayerProfile(matched) : {}
    return {
      ...base,
      username,
      name: value.name !== undefined ? value.name : (base.name || null),
      position: value.position !== undefined ? value.position : (base.position || null),
      role: value.role !== undefined ? value.role : (base.role || null),
      camp: value.camp !== undefined ? value.camp : (base.camp !== undefined ? base.camp : null),
      camp_label: value.camp !== undefined ? getCampLabel(value.camp) : (base.camp_label || 'unknown'),
      status: value.status !== undefined ? value.status : (base.status !== undefined ? base.status : null),
      status_label: value.status !== undefined ? getStatusLabel(value.status) : (base.status_label || null)
    }
  }

  const flattenRichText = content => {
    if (!content || !Array.isArray(content.content)) return null
    return content.content
      .map(item => {
        if (!item) return ''
        if (typeof item === 'string') return item
        return item.text || ''
      })
      .join('')
  }

  const extractRecordText = content => {
    if (!content) return null
    if (typeof content === 'string') return content
    if (content.type === 'speech') return content.text || null
    if (content.type === 'rich-text') return flattenRichText(content)
    if (content.text) return content.text
    return null
  }

  const inferRecordLogType = content => {
    if (!content) return 'record'
    if (content.type === 'speech') return 'speech'
    if (content.type === 'action') return 'action'
    if (content.type === 'vote') return 'vote_summary'
    if (content.type === 'rich-text') return 'system'
    return content.type || 'record'
  }

  const getActionTargetName = (username, playersByUsername) => {
    if (!username) return null
    return playersByUsername[username] ? playersByUsername[username].name : null
  }

  const toNumericStage = stage => {
    if (typeof stage === 'number') return stage
    const n = Number(stage)
    return Number.isNaN(n) ? 0 : n
  }

  const compareTimelineItem = (a, b) => {
    const dayDiff = (a.day || 0) - (b.day || 0)
    if (dayDiff !== 0) return dayDiff

    const stageDiff = toNumericStage(a.stage) - toNumericStage(b.stage)
    if (stageDiff !== 0) return stageDiff

    const ta = a.timestamp ? Date.parse(a.timestamp) : NaN
    const tb = b.timestamp ? Date.parse(b.timestamp) : NaN
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) {
      return ta - tb
    }

    return (a.source_order || 0) - (b.source_order || 0)
  }

  const buildVoteSummary = (voteActions, playersByUsername) => {
    const actions = voteActions || []
    const stageMap = {}

    actions.forEach(item => {
      const stageKey = String(item.stage)
      if (!stageMap[stageKey]) {
        stageMap[stageKey] = []
      }
      stageMap[stageKey].push(item)
    })

    const stageResults = Object.keys(stageMap)
      .sort((a, b) => Number(a) - Number(b))
      .map(stageKey => {
        const stageActions = stageMap[stageKey]
        const voteCounts = {}
        stageActions.forEach(actionItem => {
          if (!actionItem.target || !actionItem.target.username) return
          const target = actionItem.target.username
          voteCounts[target] = (voteCounts[target] || 0) + 1
        })

        let votedOutPlayerId = null
        let maxVotes = 0
        Object.keys(voteCounts).forEach(playerId => {
          if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId]
            votedOutPlayerId = playerId
          }
        })

        const votedOutPlayer = votedOutPlayerId ? buildPlayerProfile(playersByUsername[votedOutPlayerId]) : null
        return {
          stage: Number(stageKey),
          stage_name: getStageMeta(Number(stageKey)).name,
          phase: getStageMeta(Number(stageKey)).phase,
          vote_counts: voteCounts,
          vote_count: stageActions.length,
          voted_out_player_id: votedOutPlayerId,
          voted_out_name: votedOutPlayer ? votedOutPlayer.name : null,
          voted_out: votedOutPlayer
        }
      })

    const decisiveResult = stageResults.length > 0 ? stageResults[stageResults.length - 1] : null

    return {
      stage_results: stageResults,
      vote_counts: decisiveResult ? decisiveResult.vote_counts : {},
      voted_out_player_id: decisiveResult ? decisiveResult.voted_out_player_id : null,
      voted_out_name: decisiveResult ? decisiveResult.voted_out_name : null,
      voted_out: decisiveResult ? decisiveResult.voted_out : null
    }
  }

  const buildTimelineRecord = (recordItem, index, playersByUsername) => {
    const content = cloneJson(recordItem.content || {})
    const meta = getStageMeta(recordItem.stage)
    const actor = buildEmbeddedPlayer(content.from, playersByUsername)
    const target = buildEmbeddedPlayer(content.to, playersByUsername)

    return {
      event_id: 'record_' + String(recordItem._id),
      source_table: 'record',
      source_order: index + 1,
      day: recordItem.day,
      stage: recordItem.stage,
      stage_name: meta.name,
      stage_label: meta.label,
      phase: meta.phase,
      timestamp: normalizeTimestamp(recordItem.createdAt),
      audience: recordItem.isCommon === 1 ? 'public' : 'private',
      is_common: recordItem.isCommon === 1,
      is_title: recordItem.isTitle === 1,
      visible_to: Array.isArray(recordItem.view) ? cloneJson(recordItem.view) : [],
      remark: recordItem.remark || null,
      log_type: inferRecordLogType(content),
      text: extractRecordText(content),
      actor,
      target,
      action_key: content.key || content.action || null,
      speech_source: content.source || null,
      level: content.level || null,
      raw_content: content
    }
  }

  const buildTimelineAction = (actionItem, index, playersByUsername) => {
    const meta = getStageMeta(actionItem.stage)
    const actor = buildEmbeddedPlayer(actionItem.from, playersByUsername)
    const target = buildEmbeddedPlayer(actionItem.to, playersByUsername)

    return {
      event_id: 'action_' + String(actionItem._id),
      source_table: 'action',
      source_order: index + 1,
      day: actionItem.day,
      stage: actionItem.stage,
      stage_name: meta.name,
      stage_label: meta.label,
      phase: meta.phase,
      timestamp: normalizeTimestamp(actionItem.createdAt),
      log_type: actionItem.action === 'vote' ? 'vote' : 'action',
      action: actionItem.action,
      actor,
      target,
      target_name: getActionTargetName(actionItem.to, playersByUsername),
      vote_phase: actionItem.action === 'vote' ? (Number(actionItem.stage) === 6.5 ? 'pk' : 'normal') : null,
      remark: actionItem.remark || null,
      raw_action: {
        from: actionItem.from,
        to: actionItem.to,
        action: actionItem.action
      }
    }
  }

  const generateGameRecord = async (gameInstance) => {
    const { $service, $model } = app
    const { player, record, action } = $model

    try {
      const players = await $service.baseService.query(player, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id
      }, {}, { sort: { position: 1, _id: 1 } })

      const records = await $service.baseService.query(record, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id
      }, {}, { sort: { _id: 1 } })

      const actions = await $service.baseService.query(action, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id
      }, {}, { sort: { _id: 1 } })

      const playerList = players || []
      const recordList = records || []
      const actionList = actions || []

      const playersByUsername = {}
      const playerProfiles = playerList.map(item => {
        playersByUsername[item.username] = item
        return buildPlayerProfile(item)
      })

      const gameRecord = {
        schema_version: '2.0',
        generated_at: new Date().toISOString(),
        source: 'Backend/server/service/replayService.generateGameRecord',
        game_id: gameInstance._id,
        room_id: gameInstance.roomId,
        start_time: normalizeTimestamp(gameInstance.createdAt) || new Date().toISOString(),
        end_time: normalizeTimestamp(gameInstance.updatedAt) || new Date().toISOString(),
        player_count: gameInstance.playerCount,
        mode: gameInstance.mode,
        winner: gameInstance.winner,
        winner_label: getWinnerLabel(gameInstance.winner),
        days: gameInstance.day,
        metadata: {
          status: gameInstance.status,
          current_stage: gameInstance.stage,
          current_stage_name: getStageMeta(gameInstance.stage).name,
          witch_save_self: gameInstance.witchSaveSelf,
          win_condition: gameInstance.winCondition,
          flat_ticket: gameInstance.flatTicket,
          sheriff_candidate_enabled: gameInstance.p1,
          config_flags: {
            p1: gameInstance.p1,
            p2: gameInstance.p2,
            p3: gameInstance.p3
          }
        },
        players: playerProfiles,
        player_logs: {},
        final_result: {
          winner: getWinnerLabel(gameInstance.winner),
          final_state: {
            players: {}
          }
        }
      }

      playerProfiles.forEach(profile => {
        gameRecord.final_result.final_state.players[profile.username] = {
          name: profile.name,
          position: profile.position,
          role: profile.role,
          camp: profile.camp,
          camp_label: profile.camp_label,
          status: profile.status_label,
          out_reason: profile.out_reason
        }

        gameRecord.player_logs[profile.username] = {
          profile,
          speeches: [],
          actions: [],
          votes_cast: [],
          votes_received: [],
          timeline: [],
          related_events: []
        }
      })

      const recordEvents = recordList.map((item, index) => buildTimelineRecord(item, index, playersByUsername))
      const actionEvents = actionList.map((item, index) => buildTimelineAction(item, index, playersByUsername))

      recordEvents.forEach(event => {
        if (event.actor && event.actor.username && gameRecord.player_logs[event.actor.username]) {
          gameRecord.player_logs[event.actor.username].timeline.push(event)
          if (event.log_type === 'speech') {
            gameRecord.player_logs[event.actor.username].speeches.push(event)
          } else if (event.log_type === 'action') {
            gameRecord.player_logs[event.actor.username].actions.push(event)
          }
        }

        if (event.target && event.target.username && gameRecord.player_logs[event.target.username]) {
          gameRecord.player_logs[event.target.username].related_events.push(event)
        }
      })

      actionEvents.forEach(event => {
        if (event.actor && event.actor.username && gameRecord.player_logs[event.actor.username]) {
          gameRecord.player_logs[event.actor.username].timeline.push(event)
          if (event.log_type === 'vote') {
            gameRecord.player_logs[event.actor.username].votes_cast.push(event)
          } else {
            gameRecord.player_logs[event.actor.username].actions.push(event)
          }
        }

        if (event.target && event.target.username && gameRecord.player_logs[event.target.username]) {
          gameRecord.player_logs[event.target.username].related_events.push(event)
          if (event.log_type === 'vote') {
            gameRecord.player_logs[event.target.username].votes_received.push(event)
          }
        }
      })

      Object.keys(gameRecord.player_logs).forEach(username => {
        gameRecord.player_logs[username].timeline.sort(compareTimelineItem)
        gameRecord.player_logs[username].related_events.sort(compareTimelineItem)
        gameRecord.player_logs[username].speeches.sort(compareTimelineItem)
        gameRecord.player_logs[username].actions.sort(compareTimelineItem)
        gameRecord.player_logs[username].votes_cast.sort(compareTimelineItem)
        gameRecord.player_logs[username].votes_received.sort(compareTimelineItem)
      })

      const speechRecords = recordEvents.filter(item => item.log_type === 'speech')
      const recordActionLogs = recordEvents.filter(item => item.log_type === 'action')
      const voteSummaryLogs = recordEvents.filter(item => item.log_type === 'vote_summary')
      const publicRecords = recordEvents.filter(item => item.is_common)
      const privateRecords = recordEvents.filter(item => !item.is_common)
      const voteRecords = actionEvents.filter(item => item.log_type === 'vote')
      const actionRecords = actionEvents.filter(item => item.log_type !== 'vote')

      const timeline = recordEvents
        .concat(actionEvents)
        .sort(compareTimelineItem)

      gameRecord.logs = {
        timeline,
        records: recordEvents,
        public_records: publicRecords,
        private_records: privateRecords,
        speech_records: speechRecords,
        record_action_logs: recordActionLogs,
        vote_summary_logs: voteSummaryLogs,
        action_records: actionEvents,
        vote_records: voteRecords
      }

      gameRecord.timeline = timeline
      gameRecord.speech_records = speechRecords
      gameRecord.action_records = actionEvents
      gameRecord.vote_records = voteRecords
      gameRecord.events = recordEvents.map(item => ({
        day: item.day,
        stage: item.stage,
        type: item.raw_content ? item.raw_content.type : item.log_type,
        timestamp: item.timestamp,
        data: item.raw_content
      }))

      const actionBreakdown = {}
      actionEvents.forEach(item => {
        const key = item.action || 'unknown'
        actionBreakdown[key] = (actionBreakdown[key] || 0) + 1
      })

      const stageBreakdown = {}
      timeline.forEach(item => {
        const key = String(item.stage)
        stageBreakdown[key] = (stageBreakdown[key] || 0) + 1
      })

      gameRecord.game_stats = {
        total_actions: actionList.length,
        total_logs: timeline.length,
        total_records: recordList.length,
        total_public_records: publicRecords.length,
        total_private_records: privateRecords.length,
        total_speeches: speechRecords.length,
        total_votes: voteRecords.length,
        votes: voteRecords.length,
        total_ability_uses: actionRecords.filter(item => ABILITY_ACTIONS.includes(item.action)).length,
        ability_uses: actionRecords.filter(item => ABILITY_ACTIONS.includes(item.action)).length,
        total_deaths: playerList.filter(item => item.status === 0).length,
        action_breakdown: actionBreakdown,
        stage_breakdown: stageBreakdown
      }

      gameRecord.round_records = []
      for (let day = 1; day <= gameInstance.day; day++) {
        const dayRecords = recordList.filter(item => item.day === day)
        const dayRecordEvents = recordEvents.filter(item => item.day === day)
        const dayActionEvents = actionEvents.filter(item => item.day === day)
        const daySpeechEvents = speechRecords.filter(item => item.day === day)
        const dayVoteEvents = voteRecords.filter(item => item.day === day)
        const dayTimeline = timeline.filter(item => item.day === day)
        const voteSummary = buildVoteSummary(dayVoteEvents, playersByUsername)

        gameRecord.round_records.push({
          round: day,
          day,
          records: dayRecords.map(item => cloneJson(item.content)),
          record_logs: dayRecordEvents,
          speeches: daySpeechEvents,
          actions: dayActionEvents.filter(item => item.log_type !== 'vote'),
          votes: dayVoteEvents,
          timeline: dayTimeline,
          vote_results: {
            vote_counts: voteSummary.vote_counts,
            voted_out: voteSummary.voted_out,
            voted_out_player_id: voteSummary.voted_out_player_id,
            voted_out_name: voteSummary.voted_out_name,
            stage_results: voteSummary.stage_results
          }
        })
      }

      return gameRecord
    } catch (error) {
      if (app.$log4 && app.$log4.errorLogger) {
        app.$log4.errorLogger.error('[replayService] generateGameRecord failed: ' + error.toString())
      }
      throw error
    }
  }

  const analyzeGame = async (gameInstance, options = {}) => {
    const { $helper } = app

    if (!gameInstance) {
      return $helper.wrapResult(false, 'gameInstance is required', -1)
    }

    try {
      const gameRecord = await generateGameRecord(gameInstance)

      let aiConfig = null
      const apiKey = getReplayApiKey()
      if (options.enableAI && apiKey) {
        aiConfig = {
          api_key: apiKey,
          model: getReplayModel(options),
          baseurl: getReplayBaseUrl(options)
        }
      }

      const requestData = {
        game_record: gameRecord,
        ai_config: aiConfig,
        output_dir: buildOutputDir(options),
        desensitize: options.desensitize !== false
      }

      const serviceResponse = await post('/analyze', requestData)
      if (!serviceResponse.result) {
        return serviceResponse
      }

      const body = serviceResponse.data || {}
      return $helper.wrapResult(true, {
        game_record: gameRecord,
        analysis_files: body.result || null,
        timestamp: body.timestamp || null
      })
    } catch (error) {
      return $helper.wrapResult(false, 'Replay analyze failed: ' + error.message, -1)
    }
  }

  return {
    checkHealth,
    generateGameRecord,
    analyzeGame
  }
}
