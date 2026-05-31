module.exports = app => ({

  /**
   * 棰勮█瀹堕樁娈电粨绠?   * @param id
   * @returns {Promise<{result}>}
   */
  async predictorStage(id) {
    const { $service, $helper, $model, $support } = app
    const { game, player, action, record, gameTag } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    /*

    // 鍙湁绗?澶╃殑姝讳骸鐜╁鎷ユ湁閬楄█锛涚2澶╁強浠ュ悗杩涘叆閬楄█闃舵鏃朵笉瀹夋帓鍙戣█鑰呫€?    if(Number(gameInstance.day) > 1){
      let tagObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: 7,
        dayStatus: 2,
        desc: 'lastWordsOrder',
        mode: 2,
        value: 'desc',
        target: '',
        name: null,
        position: null,
        value2: [],
        value3: {
          currentIndex: 0
        }
      }

      await $service.baseService.save(gameTag, tagObject)
      await $service.baseService.save(record, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: 7,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'system',
          text: '绗?澶╁強浠ュ悗姝讳骸鐜╁娌℃湁閬楄█'
        }
      })

      return $helper.wrapResult(true, {
        speakOrder: [],
        firstSpeaker: null,
        noLastWordsAfterDayOne: true
      })
    }
    */
    let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 1, action: 'check'})
    if(!checkAction) {
      // 绌鸿繃
      let predictorPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, role: 'predictor'})
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 0,
        isTitle: 0,
        content: {
          type: 'action',
          key: 'jump',
          text: $support.getPlayerFullName(predictorPlayer) + '，预言家空验',
          actionName: '空验',
          level: 6,
          from: {
            username: predictorPlayer.username,
            name: predictorPlayer.name,
            position: predictorPlayer.position,
            status: predictorPlayer.status
          },
          to: {
            username: null,
            name: null,
          }
        }
      }
      await $service.baseService.save(record, recordObject)
    }
    return $helper.wrapResult(true, '')
  },

  /**
   * 鐙间汉琛屽姩缁撴潫鍚庣殑缁撶畻 鈥斺€?璁＄畻琚垁娆℃暟鏈€澶氱殑鐜╁浣滀负鐙间汉澶滄櫄鍑绘潃鐨勭洰鏍囷紙濡傛灉骞崇エ鍒欓殢鏈烘娊鍙栦竴浣嶇帺瀹舵浜★級
   * @param id
   * @returns {Promise<{result}>}
   */
  async wolfStage(id) {
    const { $service, $helper, $model, $support } = app
    const { game, player, action, record } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let assaultActionList = await $service.baseService.query(action, {roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage: 2, action: 'assault'})
    if(!assaultActionList || assaultActionList.length < 1){
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 0,
        isTitle: 0,
        content: {
          type: 'action',
          key: 'jump',
          text: '狼人空刀',
          actionName: '空刀',
          level: 5,
          from: {
            username: null,
            name: '狼人',
            position: null,
            role: 'wolf',
            camp: 0
          },
          to: {
            username: null,
            name: null,
          }
        }
      }
      await $service.baseService.save(record, recordObject)
      return $helper.wrapResult(true, '')
    }

    let usernameList = []
    assaultActionList.forEach(item=>{
      usernameList.push(item.to)
    })
    // 鎵惧埌浠栦滑涓鏉€娆℃暟鏈€澶氱殑
    let target = $helper.findMaxInArray(usernameList)
    let actionObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: 'wolf',
      to: target,
      action: 'kill',
    }
    await $service.baseService.save(action, actionObject)
    let diePlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: target})
    let recordObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 0,
      isTitle: 0,
      content: {
        text: '狼人今晚袭击了：' + $support.getPlayerFullName(diePlayer),
        type: 'action',
        key: 'kill',
        actionName: '袭击',
        level: 2,
        from: {
          username: null,
          name: '狼人',
          position: null,
          role: 'wolf',
          camp: 0,
        },
        to: {
          username: diePlayer.username,
          name: diePlayer.name,
          position: diePlayer.position
        }
      }
    }
    await $service.baseService.save(record, recordObject)
    return $helper.wrapResult(true, '')
  },

  /**
   * 濂冲帆琛屽姩鍚庣殑缁撶畻 - 缁撶畻鐙间汉鍑绘潃銆佽В鑽€佹瘨鑽笁鑰呯患鍚堝悗鐨勭粨鏋?   * @param id
   * @returns {Promise<{result}>}
   */
  async witchStage (id) {
    const { $service, $helper, $model, $support } = app
    const { game, player, action, record, gameTag } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    // 濂冲帆鍥炲悎 => 澶╀寒浜? 闇€瑕佺粨绠楁浜＄帺瀹跺拰娓告垙鏄惁缁撴潫
    let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 2, action: 'kill'})
    let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'antidote'})
    if(killAction && killAction.to){
      let killTarget = killAction.to
      let killPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: killTarget})
      if(!saveAction){
        let tagObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          dayStatus: gameInstance.stage < 4 ? 1 : 2,
          desc: 'assault',
          mode: 1,
          target: killPlayer.username,
          name: killPlayer.name,
          position: killPlayer.position
        }
        await $service.baseService.save(gameTag, tagObject)
        // 娉ㄥ唽璇ョ帺瀹剁殑姝讳骸
        await $service.baseService.updateOne(player,{ roomId: gameInstance.roomId, gameId: gameInstance._id, username: killPlayer.username}, { status: 0 , outReason: 'assault'})
        if(killPlayer.role === 'hunter'){
          let skills = killPlayer.skill
          let newSkillStatus = []
          skills.forEach(item=>{
            if(item.key === 'shoot'){
              newSkillStatus.push({
                name: item.name,
                key: item.key,
                status: 1
              })
            } else {
              newSkillStatus.push(item)
            }
          })
          await $service.baseService.updateById(player, killPlayer._id, {
            skill: newSkillStatus
          })
          
          if(app.$service.aiService.isAiId(killPlayer.username)){
            console.log('\n馃敨 鐚庝汉AI琚嫾浜烘潃姝伙紝璋冪敤鎶€鑳藉喅绛栨帴鍙?..')
            
            // 鑾峰彇瀛樻椿鐜╁鍒楄〃浣滀负鐩爣閫夋嫨
            let alivePlayers = await $service.baseService.query(player, {
              roomId: gameInstance.roomId,
              gameId: gameInstance._id,
              status: 1
            })
            
            let candidateTargets = alivePlayers.map(p => p.username)
            
            // 璋冪敤AI鍐崇瓥鎺ュ彛
            let invokeResult = await app.$service.aiService.invokeAgent(gameInstance, killPlayer.username, {
              stage: 'death_shot',
              candidateTargets: candidateTargets,
              privateVision: {
                hunterCanShoot: true,
                hunterShotUsed: false,
                deathReason: 'werewolf_kill'
              }
            })
            
            console.log('馃敨 鐚庝汉AI鎶€鑳藉喅绛栫粨鏋?', invokeResult)
            
            // 濡傛灉AI鍐冲畾寮€鏋紝鎵ц寮€鏋€昏緫
            let shouldShoot = false
            let shootTarget = null
            
            if(invokeResult.result && invokeResult.data && invokeResult.data.decision){
              const decision = invokeResult.data.decision
              
              // 鏂规硶1锛氭鏌killType鏄惁涓?shoot'
              if(decision.skillType === 'shoot'){
                shouldShoot = true
                shootTarget = decision.skillTarget
              }
              // 鏂规硶2锛氬鏋渟killType涓嶆槸'shoot'锛屾鏌peechText鍜宻uspicionScores
              else if(decision.speechText && decision.speechText.includes('开枪') && 
                      invokeResult.data.suspicionScores && invokeResult.data.suspicionScores.length > 0){
                const topSuspicion = invokeResult.data.suspicionScores[0]
                if(topSuspicion && topSuspicion.target && candidateTargets.includes(topSuspicion.target)){
                  shouldShoot = true
                  shootTarget = topSuspicion.target
                  console.log(`馃幆 鏍规嵁speechText鍜宻uspicionScores鍒ゆ柇锛岀寧浜篈I鍐冲畾寮€鏋紝鐩爣: ${shootTarget}`)
                }
              }
            }
            
            if(shouldShoot && shootTarget && candidateTargets.includes(shootTarget)){
              console.log(`馃幆 鐚庝汉AI鍐冲畾寮€鏋紝鐩爣: ${shootTarget}`)
              
              // 鎵ц寮€鏋€昏緫
              let targetPlayer = await $service.baseService.queryOne(player, {
                roomId: gameInstance.roomId,
                gameId: gameInstance._id,
                username: shootTarget
              })
              
              if(targetPlayer){
                await $service.baseService.updateById(player, targetPlayer._id, {status: 0, outReason: 'shoot'})
                
                let action = app.$model.action
                let actionObject = {
                  roomId: gameInstance.roomId,
                  gameId: gameInstance._id,
                  day: gameInstance.day,
                  stage: 2,
                  from: killPlayer.username,
                  to: shootTarget,
                  action: 'shoot',
                }
                await $service.baseService.save(action, actionObject)
                  
                  console.log(`鉁?鐚庝汉AI寮€鏋垚鍔燂紝${shootTarget}琚嚮鏉€`)
                }
              }
            } else {
              console.log('猎人AI决定不开枪')
            }
          }
        }
      }
      
      let poisonAction = await $service.baseService.queryOne(action, {gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'poison'});
      if(poisonAction && poisonAction.to){
        let poisonPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: poisonAction.to});
        let witchPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: poisonAction.from});
        
        let tagObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          dayStatus: gameInstance.stage < 4 ? 1 : 2,
          desc: 'poison',
          mode: 1,
          target: poisonPlayer.username,
          name: poisonPlayer.name,
          position: poisonPlayer.position
        }
        await $service.baseService.save(gameTag, tagObject)
        
        // 娉ㄥ唽鐜╁姝讳骸
        await $service.baseService.updateById(player, poisonPlayer._id, {status: 0, outReason: 'poison'});
        
        let recordObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 0,
          isTitle: 0,
          content: {
            type: 'action',
            key: 'poison',
            text: $support.getPlayerFullName(witchPlayer) + '使用毒药毒死了' + $support.getPlayerFullName(poisonPlayer),
            actionName: '毒药',
            level: 2,
            from: {
              username: witchPlayer.username,
              name: witchPlayer.name,
              position: witchPlayer.position
            },
            to: {
              username: poisonPlayer.username,
              name: poisonPlayer.name,
              position: poisonPlayer.position
            }
          }
      }
      await $service.baseService.save(record, recordObject)
    }

    if(!saveAction && !poisonAction){
      let witchPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, role: 'witch'})

      let skill = witchPlayer.skill
      let has = false
      skill.forEach(item=>{
        if(item.status === 1){
          has = true
        }
      })
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 0,
        isTitle: 0,
        content: {
          type: 'action',
          key: 'jump',
          text: $support.getPlayerFullName(witchPlayer) + '，女巫空过',
          actionName: has ? '空过' : '药已用完',
          level: 5,
          from: {
            username: witchPlayer.username,
            name: witchPlayer.name,
            status: (killAction && killAction.to === witchPlayer.username) ? 1 : witchPlayer.status,
            position: witchPlayer.position,
            role: witchPlayer.role,
            camp: witchPlayer.camp
          },
          to: {
            username: null,
            name: null,
          }
        }
      }
      await $service.baseService.save(record, recordObject)
    }

    let gameRecord = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      stage: gameInstance.stage,
      day: gameInstance.day,
      content: {
        text: '天亮了！',
        type: 'text',
        level: 4,
      },
      isCommon: 1,
      isTitle: 0
    }
    await $service.baseService.save(record, gameRecord)

    // 缁撶畻鎵€鏈夌殑姝讳骸鐜╁
    let diePlayerList = await $service.baseService.query(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage:{ $in: [2, 3]}, mode: 1})
    if(!diePlayerList || diePlayerList.length < 1){
      let peaceRecord = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'text',
          text: '昨天晚上是平安夜！',
          level: 3,
        }
      }
      await $service.baseService.save(record, peaceRecord)
    } else {
      let dieMap = {}
      for(let i = 0; i < diePlayerList.length; i++){
        if(dieMap[diePlayerList[i].target]){
          continue
        }
        let diePlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: diePlayerList[i].target})
        let deadRecord = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 1,
          isTitle: 0,
          content: {
            type: 'action',
            action: 'die',
            actionName: '死亡',
            level: 2,
            from: {
              username: diePlayer.username,
              name: diePlayer.name,
              position: diePlayer.position,
              role: diePlayer.role,
              camp: diePlayer.camp
            },
            to: {
              role: 'out',
              name: '出局'
            }
          }
        }
        await $service.baseService.save(record, deadRecord)
        dieMap[diePlayerList[i].target] = diePlayer
      }
    }
    return $helper.wrapResult(true, '')
  },

  /**
   * 杩涘叆鍙戣█鐜
   * @param id
   * @returns {Promise<{result}>}
   */
  async preSpeakStage (id) {
    const { $service, $helper, $model, $support } = app
    const { game, player, record, gameTag } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let alivePlayer = await $service.baseService.query(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, status: 1})
    alivePlayer = (alivePlayer || []).sort((a, b) => a.position - b.position)
    let randomPosition = Math.floor(Math.random() * alivePlayer.length )
    let randomOrder = Math.floor(Math.random() * 2 ) + 1 // 闅忔満鍙戣█椤哄簭
    let targetPlayer = alivePlayer[randomPosition]
    const firstNightDeadSpeakers = []
    if(gameInstance.day === 1){
      const deadTags = await $service.baseService.query(gameTag, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: 1,
        stage: { $in: [2, 3] },
        mode: 1
      }, {}, { sort: { position: 1 } })
      const addedDead = {}
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
    }
    const aliveSpeakOrder = []
    for(let i = 0; i < alivePlayer.length; i++){
      const offset = randomOrder === 1 ? i : -i
      const index = (randomPosition + offset + alivePlayer.length) % alivePlayer.length
      const item = alivePlayer[index]
      aliveSpeakOrder.push({
        username: item.username,
        name: item.name,
        position: item.position
      })
    }
    const speakOrder = firstNightDeadSpeakers.concat(aliveSpeakOrder)
    if(firstNightDeadSpeakers.length > 0){
      targetPlayer = firstNightDeadSpeakers[0]
    }
    let tagObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      dayStatus: gameInstance.stage < 4 ? 1 : 2,
      desc: 'speakOrder',
      mode: 2,
      value: randomOrder === 1 ? 'asc' : 'desc',
      target: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
      value2: speakOrder,
      value3: {
        currentIndex: 0
      }
    }
    await $service.baseService.save(gameTag, tagObject)
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
            text: '进入发言环节，由',
            level: 1,
          },
          {
            text: $support.getPlayerFullName(targetPlayer),
            level: 4,
          },
          {
            text: '开始发言。顺序为：',
            level: 1,
          },
          {
            text: randomOrder === 1 ? '正向' : '逆向',
            level: randomOrder === 1 ? 3 : 2,
          }
        ]
      }
    }
    await $service.baseService.save(record, recordObject)
    return $helper.wrapResult(true, '')
  },

  /**
   * 鎶曠エ闃舵
   * @returns {Promise<void>}
   */
  async voteStage (id, stageNumber = 6) {
    const { $service, $helper, $model, $support } = app
    const { game, player, record, action, gameTag } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)

    let needPk
    let voteActions = await $service.baseService.query(action, {roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage: stageNumber, action: 'vote'})
    voteActions = voteActions || []
    let alivePlayers = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, status: 1},{}, {sort: { position: 1 }})

    if(stageNumber === 6.5 && gameInstance.flatTicket === 2){
      let pkTag = await $service.baseService.queryOne(gameTag, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        mode: 3,
        desc: 'pkPlayer'
      })
      let pkPlayers = pkTag ? pkTag.value2 : []
      let leftPlayers = []
      alivePlayers.forEach(item=>{
        if(!pkPlayers.includes(item.username)){
          leftPlayers.push(item)
        }
      })
      alivePlayers = leftPlayers
    }

    let voteResultMap = {}
    for(let i = 0; i < voteActions.length; i++){
      let item = voteActions[i]
      let from = item.from
      let to = item.to
      let fromPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: from})
      if(voteResultMap[to]){
        voteResultMap[to].push({username: from, position: fromPlayer.position})
      } else {
        voteResultMap[to] = [{username: from, position: fromPlayer.position}]
      }
    }

    let abstainedPlayer = []
    alivePlayers.forEach(item=>{
      let exist = voteActions.find(function (vote) {
        return vote.from === item.username
      })
      if(!exist){
        abstainedPlayer.push(item)
      }
    })

    for(let key in voteResultMap){
      let content = voteResultMap[key]
      // 鎺掑簭
      content = content.sort(function (a,b){
        return a.position - b.position
      })
      let votePlayerString = ''
      let toPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: key})
      for(let i = 0; i < content.length; i++){
        let fromPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: content[i].username})
        if(i !== 0){
          votePlayerString = votePlayerString + '、'
        }
        votePlayerString = votePlayerString + fromPlayer.position + '号'
      }
      let voteResultString = votePlayerString + '投票给了' + toPlayer.position + '号玩家（' + toPlayer.name + ')'
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'vote',
          actionName: '投票',
          text: voteResultString,
          action: 'vote',
          level: 4,
          from: {
            username: null,
            name: votePlayerString,
            position: null,
            role: null,
            camp: null
          },
          to: {
            username: toPlayer.username,
            name: toPlayer.position + '号（共' + content.length + '票）',
            position: toPlayer.position,
            role: null,
            camp: null
          }
        }
      }
      await $service.baseService.save(record, recordObject)
    }

    // 澶勭悊寮冪エrecord
    if(abstainedPlayer && abstainedPlayer.length > 0){
      let abstainedString = ''
      for(let i =0; i < abstainedPlayer.length; i++){
        if(i !== 0){
          abstainedString = abstainedString + '、'
        }
        abstainedString = abstainedString + abstainedPlayer[i].position + '号'
      }

      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'vote',
          actionName: '弃票',
          text: abstainedString + '弃票',
          action: 'abstained',
          level: 5,
          from: {name: abstainedString},
          to: {
            name: '弃票',
            username: null
          }
        }
      }
      await $service.baseService.save(record, recordObject)
    }

    if(!voteActions || voteActions.length < 1){
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          text: '所有人弃票，没有玩家出局',
          type: 'text',
          level: 2,
        }
      }
      await $service.baseService.save(record, recordObject)
    } else {
      let usernameList = []
      voteActions.forEach(item=>{
        usernameList.push(item.to)
      })
      let maxCount = $helper.findMaxValue(usernameList)
      if(maxCount.length < 1){
        let recordObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 1,
          isTitle: 0,
          content: {
            text: '所有人弃票，没有玩家出局',
            type: 'text',
            level: 2,
          }
        }
        await $service.baseService.save(record, recordObject)
      } else if(maxCount.length ===  1){
        let max = maxCount[0]
        let votePlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: max})
        let recordObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 1,
          isTitle: 0,
          content: {
            type: 'action',
            actionName: '放逐',
            action: 'out',
            text: $support.getPlayerFullName(votePlayer) + '获得最高票数，出局',
            level: 2,
            from: {
              name: votePlayer.name,
              username: votePlayer.username,
              position: votePlayer.position,
              role: votePlayer.role,
              camp: votePlayer.camp
            },
            to: {
              role: 'exile',
              name: '放逐出局'
            }
          }
        }
        await $service.baseService.save(record, recordObject)

        // 娉ㄥ唽姝讳骸
        let tagObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          dayStatus: gameInstance.stage < 4 ? 1 : 2,
          desc: 'vote',
          mode: 1,
          target: votePlayer.username,
          name: votePlayer.name,
          position: votePlayer.position
        }
        await $service.baseService.save(gameTag, tagObject)
        await $service.baseService.updateById(player, votePlayer._id,{status: 0, outReason: 'vote'})
        if(votePlayer.role === 'hunter'){
          let skills = votePlayer.skill
          let newSkillStatus = []
          skills.forEach(item=>{
            if(item.key === 'shoot'){
              newSkillStatus.push({
                name: item.name,
                key: item.key,
                status: 1
              })
            } else {
              newSkillStatus.push(item)
            }
          })
          await $service.baseService.updateById(player, votePlayer._id, {
            skill: newSkillStatus
          })
          
          if(app.$service.aiService.isAiId(votePlayer.username)){
            console.log('\n馃敨 鐚庝汉AI琚姇绁ㄥ嚭灞€锛岃皟鐢ㄦ妧鑳藉喅绛栨帴鍙?..')
            
            // 鑾峰彇瀛樻椿鐜╁鍒楄〃浣滀负鐩爣閫夋嫨
            let alivePlayers = await $service.baseService.query(player, {
              roomId: gameInstance.roomId,
              gameId: gameInstance._id,
              status: 1
            })
            
            let candidateTargets = alivePlayers.map(p => p.username)
            
            // 璋冪敤AI鍐崇瓥鎺ュ彛
            let invokeResult = await app.$service.aiService.invokeAgent(gameInstance, votePlayer.username, {
              stage: 'vote',
              candidateTargets: candidateTargets,
              privateVision: {
                hunterCanShoot: true,
                hunterShotUsed: false,
                deathReason: 'vote'
              }
            })
            
            console.log('馃敨 鐚庝汉AI鎶€鑳藉喅绛栫粨鏋?', invokeResult)
            
            // 濡傛灉AI鍐冲畾寮€鏋紝鎵ц寮€鏋€昏緫
            if(invokeResult.result && invokeResult.data && invokeResult.data.decision && invokeResult.data.decision.skillType === 'shoot'){
              let shootTarget = invokeResult.data.decision.skillTarget
              if(shootTarget && candidateTargets.includes(shootTarget)){
                console.log(`馃幆 鐚庝汉AI鍐冲畾寮€鏋紝鐩爣: ${shootTarget}`)
                
                // 鎵ц寮€鏋€昏緫
                let targetPlayer = await $service.baseService.queryOne(player, {
                  roomId: gameInstance.roomId,
                  gameId: gameInstance._id,
                  username: shootTarget
                })
                
                if(targetPlayer){
                  await $service.baseService.updateById(player, targetPlayer._id, {status: 0, outReason: 'shoot'})
                  
                  let action = app.$model.action
                  let actionObject = {
                    roomId: gameInstance.roomId,
                    gameId: gameInstance._id,
                    day: gameInstance.day,
                    stage: 4,
                    from: votePlayer.username,
                    to: shootTarget,
                    action: 'shoot',
                  }
                  await $service.baseService.save(action, actionObject)
                  
                  console.log(`鉁?鐚庝汉AI寮€鏋垚鍔燂紝${shootTarget}琚嚮鏉€`)
                }
              }
            } else {
              console.log('猎人AI决定不开枪')
            }
          }
        }
      } else {
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
                text: '平票',
                level: 2,
              },
              {
                text: '，没有玩家出局',
                level: 1,
              }
            ]
          }
        }
        await $service.baseService.save(record, recordObject)

        // 闇€瑕乸k鐨勯€昏緫
        if(gameInstance.flatTicket === 2 && stageNumber === 6){
          let num = Math.floor(Math.random() * maxCount.length)
          let randomOrder = Math.floor(Math.random() * 2 ) + 1 // 1鍒?鐨勯殢鏈烘暟
          let targetPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: maxCount[num]})
          let tagObject = {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: gameInstance.stage,
            dayStatus: gameInstance.stage < 4 ? 1 : 2,
            desc: 'pkOrder',
            mode: 2,
            value: randomOrder === 1 ? 'asc' : ' desc', // asc 涓婂崌锛堟搴忥級 ; desc 涓嬮檷锛堥€嗗簭锛?            target: targetPlayer.username,
            name: targetPlayer.name,
            position: targetPlayer.position
          }
          await $service.baseService.save(gameTag, tagObject)

          let pkPlayerString = ''
          for(let i = 0; i < maxCount.length; i ++ ){
            let pkPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: maxCount[i]})
            pkPlayerString = pkPlayerString + $support.getPlayerFullName(pkPlayer)
            if(i < maxCount.length - 1){
              pkPlayerString = pkPlayerString + '、'
            }
          }
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
                  text: '进入',
                  level: 1,
                },
                {
                  text: '加赛pk',
                  level: 2,
                },
                {
                  text: '环节，',
                  level: 1,
                },
                {
                  text: pkPlayerString,
                  level: 3,
                },
                {
                  text: '进行pk',
                  level: 2,
                },
                {
                  text: '，由',
                  level: 1,
                },
                {
                  text: $support.getPlayerFullName(targetPlayer),
                  level: 4,
                },
                {
                  text: '先开始发言。顺序为：',
                  level: 1,
                },
                {
                  text: randomOrder === 1 ? '正向' : '逆向',
                  level: randomOrder === 1 ? 3 : 2,
                }
              ]
            }
          }
          await $service.baseService.save(record, recordObject)

          let pkTagObject = {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: gameInstance.stage,
            dayStatus: gameInstance.stage < 4 ? 1 : 2,
            desc: 'pkPlayer',
            mode: 3,
            value2: maxCount,
            target: 'pkPlayer',
          }
          await $service.baseService.save(gameTag, pkTagObject)
          // 杩涘叆鍒?.5闃舵锛坧k闃舵锛?          needPk = 'Y'
        }
      }
    }

    await $service.gameService.settleGameOver(gameInstance._id)
    return $helper.wrapResult(true, needPk)
  },

  /**
   * 鍒濆鍖栭仐瑷€闃舵鍙戣█杞
   * @param id
   * @returns {Promise<{result}>}
   */
  async initLastWordsStage (id) {
    const { $service, $helper, $model, $support } = app
    const { game, player, record, gameTag } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空', -1)
    }
    
    let gameInstance = await $service.baseService.queryById(game, id)

    await $service.baseService.delete(gameTag, {
      gameId: gameInstance._id,
      roomId: gameInstance.roomId,
      day: gameInstance.day,
      desc: 'lastWordsOrder',
      mode: 2
    })

    const voteDeathTags = await $service.baseService.query(gameTag, {
      gameId: gameInstance._id,
      roomId: gameInstance.roomId,
      day: gameInstance.day,
      desc: 'vote',
      mode: 1
    }, {}, { sort: { position: -1 } })

    const todayDeadPlayers = []
    const added = new Set()
    for(const tag of (voteDeathTags || [])){
      if(!tag.target || added.has(tag.target)){
        continue
      }
      const deadPlayer = await $service.baseService.queryOne(player, {
        gameId: gameInstance._id,
        roomId: gameInstance.roomId,
        username: tag.target,
        status: 0
      })
      if(deadPlayer){
        todayDeadPlayers.push(deadPlayer)
        added.add(tag.target)
      }
    }
    
    // 鏃犺鏈夋病鏈夋浜＄帺瀹堕兘杩涘叆閬楄█闃舵锛岃鎴夸富鑷繁鎺у埗
    if(todayDeadPlayers.length === 0){
      console.log('今天没有投票出局玩家，遗言阶段为空')
      
      // 鍒涘缓绌虹殑閬楄█鍙戣█杞锛堟病鏈夊彂瑷€鑰咃級
      let tagObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: 7, // 閬楄█闃舵
        dayStatus: 2,
        desc: 'lastWordsOrder',
        mode: 2,
        value: 'desc', // 鎸夊骇浣嶅彿浠庡ぇ鍒板皬
        target: '', // 娌℃湁鍙戣█鑰?        name: null,
        position: null,
        value2: [], // 绌虹殑鍙戣█椤哄簭
        value3: {
          currentIndex: 0
        }
      }
      
      await $service.baseService.save(gameTag, tagObject)
      
      // 鍒涘缓閬楄█闃舵璁板綍
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: 7,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'system',
          text: '遗言阶段开始，今天没有投票出局玩家'
        }
      }
      await $service.baseService.save(record, recordObject)
      
      return $helper.wrapResult(true, { 
        speakOrder: [],
        firstSpeaker: null,
        noDeadPlayers: true
      })
    }
    
    console.log('今天投票出局的玩家', todayDeadPlayers.map(p => `${p.position}号${p.name}`))
    
    // 鎸夊骇浣嶅彿浠庡ぇ鍒板皬鎺掑簭鍙戣█椤哄簭
    const sortedDeadPlayers = todayDeadPlayers.sort((a, b) => b.position - a.position)
    
    const speakOrder = sortedDeadPlayers.map(player => ({
      username: player.username,
      name: player.name,
      position: player.position
    }))
    
    // 鍒涘缓閬楄█鍙戣█杞tag
    let tagObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: 7, // 閬楄█闃舵
      dayStatus: 2,
      desc: 'lastWordsOrder',
      mode: 2,
      value: 'desc', // 鎸夊骇浣嶅彿浠庡ぇ鍒板皬
      target: speakOrder[0].username, // 绗竴涓彂瑷€鑰?      name: speakOrder[0].name,
      position: speakOrder[0].position,
      value2: speakOrder,
      value3: {
        currentIndex: 0
      }
    }
    
    await $service.baseService.save(gameTag, tagObject)
    
    // 鍒涘缓閬楄█闃舵璁板綍
    let recordObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: 7,
      view: [],
      isCommon: 1,
      isTitle: 0,
      content: {
        type: 'system',
        text: '遗言阶段开始，今天投票出局的' + speakOrder.length + '位玩家将按座位号从大到小顺序发表遗言'
      }
    }
    await $service.baseService.save(record, recordObject)
    
    console.log('遗言发言顺序初始化完成', speakOrder)
    
    return $helper.wrapResult(true, { 
      speakOrder,
      firstSpeaker: speakOrder[0]
    })
  }
})
