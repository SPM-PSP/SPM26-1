import React, {useState, useEffect, useRef} from "react";
import "./index.styl";
import Websocket from 'react-websocket';
import {inject, observer} from "mobx-react";
import {withRouter} from "react-router-dom";

import apiGame from '@api/game'
import apiRoom from '@api/room'
import apiVoice from '@api/voice'

import {Button, Modal, message} from "antd";
import WolfVoiceChat from '@components/wolfVoiceChat';
import SimpleWolfVoiceChat from '@components/wolfVoiceChat/simple';
import GameHeaderView from "@components/game/gameHeader";
import GameFooterView from "@components/game/gameFooter";
import GameReadyView from "@components/game/gameReady";
import GameContentView from "@components/game/gameContent";
import GameBtnView from "@components/game/gameButton";
import RecordView from "@components/game/gameRecord";

import vote from "@assets/images/role/skill/vote.svg"
import loser from "@assets/images/shibai.svg"

import constants from "@common/constants";
import utils from '@utils'
import cls from "classnames";

const { confirm, info } = Modal;
const { modalDescMap, roleCardMap, roleMap } = constants

const Index = (props) => {
  const {appStore, history} = props;
  const {user} = appStore

  let roomId =  history.location.state && history.location.state.id

  const [roomDetail, setRoomDetail] = useState({})
  const [seatInfo, setSeatInfo] = useState([])
  const [gameDetail, setGameDetail] = useState({})
  const [playerInfo, setPlayerInfo] = useState([])
  const [currentRole, setCurrentRole] = useState({})
  const [skillInfo, setSkillInfo] = useState([])
  const [actionInfo, setActionInfo] = useState([])
  
  // 狼人聊天状态
  const [showWolfVoiceChat, setShowWolfVoiceChat] = useState(false)
  const [showSimpleWolfVoiceChat, setShowSimpleWolfVoiceChat] = useState(false)
  const [showWolfChat, setShowWolfChat] = useState(false)
  const [wolfChatMessage, setWolfChatMessage] = useState('')
  const [wolfMessages, setWolfMessages] = useState([])

  const [errorPage, setErrorPage] = useState(false)

  const [recordModal, setRecordModal] = useState(false)
  const [gameRecord, setGameRecord] = useState([])

  const [currentAction, setCurrentAction] = useState('')
  const [actionModal, setActionModal] = useState(false)
  const [actionPlayer, setActionPlayer] = useState([])
  const [actionResult, setActionResult] = useState(null)

  const [socketOn,setSocketOn] = useState(true)
  const [roleCard, setRoleCard] = useState(null)
  const [winCard, setWinCard] = useState(null)

  const [timerTime, setTimerTime] = useState(null)
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [voiceSubmitting, setVoiceSubmitting] = useState(false)
  const mediaRecorderRef = useRef(null)
  const voiceChunksRef = useRef([])
  const voiceStreamRef = useRef(null)
  const playedSpeechIdsRef = useRef(new Set())
  const speechQueueRef = useRef([])
  const speechPlayingRef = useRef(false)
  const speechInitializedRef = useRef(false)
  const speechPlayerIdRef = useRef('speech-player-' + Date.now() + '-' + Math.random())

  useEffect(()=>{
    getRoomDetail()
  },[])

  useEffect(()=>{
    if(!gameDetail._id){
      return
    }
    const records = gameDetail.speechRecords || []
    if(!speechInitializedRef.current){
      records.forEach(item => {
        if(item && item._id){
          playedSpeechIdsRef.current.add(item._id)
        }
      })
      speechInitializedRef.current = true
      return
    }
    records.forEach(item => {
      const speechKey = getSpeechKey(item)
      if(!item || !speechKey || playedSpeechIdsRef.current.has(speechKey)){
        return
      }
      playedSpeechIdsRef.current.add(speechKey)
      speechQueueRef.current.push(item)
    })
    playNextSpeech()
  }, [gameDetail.speechRecords])

  const hashSpeech = (text) => {
    let hash = 0
    const content = String(text || '')
    for(let i = 0; i < content.length; i++){
      hash = ((hash << 5) - hash) + content.charCodeAt(i)
      hash |= 0
    }
    return String(hash)
  }

  const getSpeechKey = (speech) => {
    if(!speech){
      return ''
    }
    const from = speech.from && speech.from.username ? speech.from.username : ''
    return [
      gameDetail._id,
      speech.day,
      speech.stage,
      from,
      hashSpeech(speech.text)
    ].join(':')
  }

  const acquireSpeechPlayLock = (speech) => {
    const speechKey = getSpeechKey(speech)
    if(!speechKey){
      return false
    }
    const storageKey = 'werewolf:speech-played:' + speechKey
    const now = Date.now()
    try {
      const raw = localStorage.getItem(storageKey)
      if(raw){
        const data = JSON.parse(raw)
        if(data && data.expiresAt && data.expiresAt > now){
          return false
        }
      }
      localStorage.setItem(storageKey, JSON.stringify({
        playerId: speechPlayerIdRef.current,
        expiresAt: now + 10 * 60 * 1000
      }))
      return true
    } catch (e) {
      return true
    }
  }

  const playNextSpeech = () => {
    if(speechPlayingRef.current){
      return
    }
    const speech = speechQueueRef.current.shift()
    if(!speech || !speech.text){
      return
    }
    if(!acquireSpeechPlayLock(speech)){
      playNextSpeech()
      return
    }
    speechPlayingRef.current = true
    apiVoice.tts(speech.text).then(blob=>{
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      const finish = () => {
        URL.revokeObjectURL(url)
        speechPlayingRef.current = false
        playNextSpeech()
      }
      audio.onended = finish
      audio.onerror = finish
      audio.play().catch(()=>{
        finish()
      })
    }).catch(()=>{
      speechPlayingRef.current = false
      playNextSpeech()
    })
  }

  const startVoiceRecord = async () => {
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder){
      message.error('当前浏览器不支持录音')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceStreamRef.current = stream
      voiceChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if(event.data && event.data.size > 0){
          voiceChunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        const audioBlob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        voiceChunksRef.current = []
        if(voiceStreamRef.current){
          voiceStreamRef.current.getTracks().forEach(track => track.stop())
          voiceStreamRef.current = null
        }
        submitVoiceSpeech(audioBlob)
      }
      recorder.start()
      setVoiceRecording(true)
    } catch (e) {
      message.error('无法访问麦克风')
    }
  }

  const stopVoiceRecord = () => {
    const recorder = mediaRecorderRef.current
    if(!recorder || recorder.state === 'inactive'){
      return
    }
    setVoiceRecording(false)
    recorder.stop()
  }

  const submitVoiceSpeech = (audioBlob) => {
    if(!audioBlob || audioBlob.size < 1){
      message.error('录音为空')
      return
    }
    setVoiceSubmitting(true)
    apiVoice.speech(audioBlob, {
      roomId: gameDetail.roomId,
      gameId: gameDetail._id
    }).then(data=>{
      message.success('发言已提交：' + data.text)
      initGame(gameDetail._id, gameDetail.roomId)
    }).finally(()=>{
      setVoiceSubmitting(false)
    })
  }

  const getRoomDetail = (isBegin) => {
    apiRoom.getRoomInfo({id: roomId}).then(data=>{
      setRoomDetail(data)
      if(data.status === 0){
        initSeat(data)
      } else if (data.status === 1) {
        initGame(data.gameId, data._id, isBegin)
      }
    }).catch(error=>{
      console.log('获取房间信息失败！',error)
      setErrorPage(true)
    })
  }

  const initGame = (gameId, roomId, isBegin) => {
    if(!gameId){
      console.log('initGame失败：gameId不存在')
      message.warn('游戏id不存在！')
      return
    }
    apiGame.getGameInfo({id: gameId, roomId: roomId}).then(data=>{
      setGameDetail(data)
      setCurrentRole(data.roleInfo || {})
      console.log(data.playerInfo)
      setPlayerInfo(data.playerInfo || [])
      setSkillInfo(data.skill || [])
      setActionInfo(data.action || [])
      if(isBegin){
        openRoleCard(data.roleInfo)
      }
    }).catch(error=>{
      console.log('发生了错误！',error)
      message.error('获取游戏信息失败，请稍后重试')
    })
  }

  const initSeat = (detail) => {
    if(!detail.seat){
      let p = []
      for(let i =0; i< 12; i++){
        p.push({
          index: i,
          key: i + 1,
          name: (i + 1) + '号',
          player: null
        })
      }
      setSeatInfo(p)
    } else {
      let p = []
      for(let i = 0; i < detail.seat.length; i++){
        let item = detail.seat[i]
        p.push({
          index: i,
          key: item.position,
          name: item.name,
          player: item.player ? item.player : null
        })
      }
      // 排序
      p.sort(function (a,b){
        return a.key - b.key
      })
      setSeatInfo(p)
    }
  }

  const initRecordList = (data) => {
    let tmp = []
    for(let key in data){
      tmp.push(data[key])
    }
    setGameRecord(tmp)
    setRecordModal(true)
  }

  const quitRoom = () => {
    if(!roomId){
      history.push({pathname: '/index'})
      return
    }
    setSocketOn(false)
    apiRoom.quitRoom({id: roomId, username: user.username}).then(()=>{
      history.push({pathname: '/index'})
    }).catch(()=>{
      setSocketOn(true)
    })
  }

  const lookRecord = () => {
    apiGame.gameRecord({roomId: gameDetail.roomId, gameId: gameDetail._id}).then(data=>{
      initRecordList(data)
    })
  }

  const useSkill = (key) => {
    setCurrentAction(key)
    if(key === 'antidote' || key === 'boom'){
      playerAction(null, key, true)
      return
    }
    if(key === 'check'){
      // 预言家查验, 计算查验数组
      let tmp = []
      playerInfo.forEach(item=>{
        let canCheck = true
        if(item.status === 0){
          // 死人不能查
          canCheck = false
        } else if (item.isSelf){
          // 不能查验自己
          canCheck = false
        } else if (item.camp !== null && item.camp !== undefined){
          // 知晓身份的也不用查
          canCheck = false
        }
        tmp.push({...item, check: canCheck, isTarget: false})
      })
      setActionPlayer(tmp)
      setActionModal(true)
      return
    }

    if(key === 'assault' || key === 'shoot' || key === 'poison' || key === 'vote'){
      // 预言家查验, 计算查验数组
      let tmp = []
      playerInfo.forEach(item=>{
        let canCheck = true
        if(item.status === 0){
          // 不能对死人发动技能
          canCheck = false
        }
        if(!item.isTarget){
          canCheck = false
        }
        tmp.push({...item, check: canCheck, isTarget: false})
      })
      setActionPlayer(tmp)
      setActionModal(true)
      return;
    }

    message.error('未识别的动作！')
  }

  // 获取AI狼人建议
  const fetchWolfSuggestions = async () => {
    if (!gameDetail._id || !roomId) return
    
    console.log('🔍 开始获取AI建议...', {
      roomId: roomId,
      gameId: gameDetail._id,
      gameDay: gameDetail.day,
      gameStage: gameDetail.stage
    })
    
    try {
      const response = await apiGame.getWolfSuggestions({
        roomId: roomId,
        gameId: gameDetail._id
      })
      
      console.log('📡 AI建议API完整响应:', response)
      console.log('📡 response.result:', response.result)
      console.log('📡 response.data:', response.data)
      
      if (response.result) {
        const suggestions = response.data.suggestions || []
        console.log('✅ AI建议获取成功:', {
          suggestions: suggestions,
          count: suggestions.length,
          firstSuggestion: suggestions[0] || '无'
        })
        setWolfSuggestions(suggestions)
        if (suggestions.length > 0) {
          setShowSuggestions(true)
          console.log('🎯 设置显示AI建议为true')
        } else {
          console.log('⚠️ 暂无AI建议')
        }
      } else {
        console.log('❌ AI建议获取失败:', response.errorMessage)
      }
    } catch (error) {
      console.error('💥 获取AI狼人建议异常:', error)
      message.error('获取AI狼人建议失败: ' + error.message)
    }
  }

  // 显示AI建议的弹窗
  const showWolfSuggestionsModal = () => {
    console.log('🎯 显示AI建议弹窗，当前建议数量:', wolfSuggestions.length)
    console.log('🎯 wolfSuggestions内容:', wolfSuggestions)
    
    if (wolfSuggestions.length === 0) {
      console.log('⚠️ 没有AI建议，显示提示信息')
      message.info('暂无AI建议')
      return
    }

    Modal.info({
      title: '🐺 AI狼人建议',
      width: 600,
      content: (
        <div style={{maxHeight: '400px', overflowY: 'auto'}}>
          {wolfSuggestions.map((suggestion, index) => (
            <div key={index} style={{marginBottom: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '6px'}}>
              <div style={{fontWeight: 'bold', color: '#1890ff', marginBottom: '8px'}}>
                {suggestion.content.aiName} 的建议：
              </div>
              {suggestion.content.speechText && (
                <div style={{marginBottom: '8px'}}>
                  <strong>分析：</strong> {suggestion.content.speechText}
                </div>
              )}
              {suggestion.content.suggestedTarget && (
                <div style={{marginBottom: '8px'}}>
                  <strong>建议目标：</strong> {suggestion.content.suggestedTarget}
                </div>
              )}
              {suggestion.content.confidence && (
                <div style={{marginBottom: '8px'}}>
                  <strong>置信度：</strong> {Math.round(suggestion.content.confidence * 100)}%
                </div>
              )}
              {suggestion.content.explain && suggestion.content.explain.length > 0 && (
                <div>
                  <strong>理由：</strong>
                  <ul style={{margin: '4px 0', paddingLeft: '20px'}}>
                    {suggestion.content.explain.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )
    })
  }

  // 获取角色名称
  const getRoleName = (role) => {
    const roleMap = {
      'wolf': '狼人',
      'villager': '村民',
      'predictor': '预言家',
      'witch': '女巫',
      'hunter': '猎人'
    }
    return roleMap[role] || role
  }

  // 获取角色颜色
  const getRoleColor = (role) => {
    const colorMap = {
      'wolf': '#ff4d4f',
      'villager': '#52c41a',
      'predictor': '#1890ff',
      'witch': '#722ed1',
      'hunter': '#fa8c16'
    }
    return colorMap[role] || '#666'
  }

  // 狼人聊天消息发送
  const sendWolfMessage = () => {
    if (!wolfChatMessage.trim()) {
      message.warning('请输入消息内容')
      return
    }

    const messageData = {
      type: 'wolfChat',
      roomId: roomId,
      gameId: gameDetail._id,
      sender: currentRole.name || currentRole.username,
      senderUsername: currentRole.username,
      message: wolfChatMessage.trim(),
      timestamp: new Date().toISOString()
    }

    // 通过WebSocket发送消息
    if (window.ws && window.ws.readyState === 1) {
      window.ws.send(JSON.stringify(messageData))
    } else {
      // 备用方案：通过postMessage
      window.postMessage(messageData, '*')
    }

    // 添加到自己的消息列表
    setWolfMessages(prev => [...prev, messageData])
    setWolfChatMessage('')
  }

  // 处理WebSocket消息
  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        
        if (data.type === 'wolfChat' && 
            data.roomId == roomId && 
            data.gameId == gameDetail._id &&
            data.senderUsername !== currentRole.username) {
          
          setWolfMessages(prev => [...prev, data])
        }
      } catch (error) {
        console.error('处理WebSocket消息失败:', error)
      }
    }

    // 监听WebSocket消息
    const messageHandler = (event) => {
      if (event.data && typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage({ data })
        } catch (e) {
          // 如果不是JSON格式，直接处理
          handleWebSocketMessage({ data: event.data })
        }
      }
    }

    if (window.ws) {
      window.ws.addEventListener('message', messageHandler)
    }

    // 监听postMessage（备用方案）
    window.addEventListener('message', (event) => {
      if (event.data && typeof event.data === 'object' && event.data.type === 'wolfChat') {
        handleWebSocketMessage({ data: event.data })
      }
    })

    return () => {
      if (window.ws) {
        window.ws.removeEventListener('message', messageHandler)
      }
    }
  }, [roomId, gameDetail._id, currentRole.username])

  const playerAction = (player, action, needConfirm) => {
    const fetchMap = {
      'check': {
        api: apiGame.checkPlayer,
        role: 'predictor'
      },
      'assault': {
        api: apiGame.assaultPlayer,
        role: 'wolf',
      },
      'poison': {
        api: apiGame.poisonPlayer,
        role: 'witch'
      },
      'vote': {
        api: apiGame.votePlayer,
        role: null
      },
      'shoot': {
        api: apiGame.shootPlayer,
        role: 'hunter'
      },
      'boom': {
        api:  apiGame.boomPlayer,
        role: 'wolf',
      },
      'antidote': {
        api: apiGame.antidotePlayer,
        role: 'witch'
      }
    }

    let params = {roomId: gameDetail.roomId, gameId: gameDetail._id}
    if(player){
      params.username = player.username
    }

    if(needConfirm){
      // 调试信息：检查条件
      console.log('🔍 检查AI建议条件:', {
        action: action,
        currentRole: currentRole,
        isWolf: currentRole.role === 'wolf',
        needConfirm: needConfirm
      })
      
      // 如果是狼人袭击，先获取AI建议
      if(action === 'assault' && currentRole.role === 'wolf'){
        console.log('✅ 进入AI建议流程')
        // 等待一段时间让AI生成建议，然后获取
        setTimeout(() => {
          fetchWolfSuggestions().then(() => {
            confirm(
              {
                title: modalDescMap[action] ? modalDescMap[action].confirm : '',
                okText: '查看AI建议',
                cancelText: '直接袭击',
                onOk() {
                  showWolfSuggestionsModal()
                },
                onCancel() {
                  actionFetch(fetchMap[action] ? fetchMap[action].api : null, params, fetchMap[action] ? fetchMap[action].role : null)
                }
              }
            )
          })
        }, 2000) // 等待2秒让AI生成建议
      } else {
        console.log('⚠️ 不满足AI建议条件，使用普通确认框')
        confirm(
          {
            title: modalDescMap[action] ? modalDescMap[action].confirm : '',
            okText: '确定',
            cancelText: '取消',
            onOk() {
              actionFetch(fetchMap[action] ? fetchMap[action].api : null, params, fetchMap[action] ? fetchMap[action].role : null)
            }
          }
        )
      }
      return
    }
    actionFetch(fetchMap[action] ? fetchMap[action].api : null, params, fetchMap[action] ? fetchMap[action].role : null)
  }

  const actionFetch = (fetch, params, role) => {
    if(!fetch){
      message.error('未识别的动作！')
      return;
    }

    if(role && currentRole.role !== role){
      message.warn('你不是' + roleMap[role] + '，不能进行此操作！')
      return
    }
    fetch(params).then(data=>{
      message.success('操作成功！')
      actionFinish(data)
    })
  }

  const actionFinish= (data) => {
    setActionResult(data)
    let newCheckPlayer = JSON.parse(JSON.stringify(actionPlayer))
    let tmp = []
    newCheckPlayer.forEach(item=>{
      if(item.username === data.username){
        let obj = {...item, camp: data.camp, campName: data.campName, isTarget: true}
        tmp.push(obj)
      } else {
        tmp.push(item)
      }
    })
    setActionPlayer(tmp)
    // 刷新game
    initGame(gameDetail._id, gameDetail.roomId)
  }

  const openRoleCard = (roleInfo) => {
    let src = roleCardMap[currentRole.role]
    if(roleInfo){
      src = roleCardMap[roleInfo.role]
    }
    const config = {
      title: '您的身份是' + (gameDetail.isOb ? '观战者' : ''),
      icon: null,
      okText: '确认',
      content: (
        <div className="role-card-wrap FBV FBAC">
          <img className="card-img" src={src} />
        </div>
      )
    }
    let roleCardView = info(config)
    setRoleCard(roleCardView)
  }

  const clearGame = () => {
    setGameDetail({})
  }

  const showWinner = (data) => {
    const config = {
      okText: '确定',
      icon: null,
      title: (
        <div className="color-red winner-title FBH FBJC">
          <div className={cls({
            'color-red': data.winner === 0,
            'color-orange': data.winner === 1
          })}>{data.winnerString}</div>
          <div className="mar-l5 color-green">胜利!</div>
        </div>
      ),
      content: (
        <div className="winner-wrap">
          <div className="img-card-wrap FBV FBAC FBJC">
            <img src={roleCardMap[currentRole.role]} />
            {
              currentRole.camp === data.winner ? null : (
                <>
                  <div className="winner-mask" />
                  <div className="winner-mask-text-wrap FBV FBAC FBJC">
                    <img src={loser} />
                    <div className="txt mar-t10">很遗憾，你输了~</div>
                  </div>
                </>
              )
            }
          </div>
        </div>
      )
    }
    let winCardView = info(config)
    setWinCard(winCardView)
  }

  const wsMessage = (msg) => {
    if(msg === 'refreshRoom'){
      if(socketOn){
        getRoomDetail()
      }
    } else if (msg === 'refreshGame') {
      initGame(gameDetail._id, roomDetail._id)
    } else if (msg === 'stageChange') {
      setActionPlayer([])
      setCurrentAction('')
      setActionResult(null)
      closeAllModel()
      initGame(gameDetail._id, roomDetail._id)
    } else if (msg === 'gameStart'){
      getRoomDetail(true)
    } else if (msg === 'gameOver') {
      apiGame.gameResult({id: gameDetail._id}).then(data=>{
        // 关闭所有的弹窗
        closeAllModel()
        showWinner(data)
      })
    } else if (msg === 'reStart'){
      closeAllModel()
      setActionPlayer([])
      setCurrentAction('')
      setActionResult(null)
      setPlayerInfo([])
      setCurrentRole({})
      if(socketOn){
        getRoomDetail()
      }
    } else {
      // 处理定时器
      let msgData = JSON.parse(msg)
      if(msgData.time !== null ){
        setTimerTime(msgData.time)
      }
    }
  }

  const closeAllModel = () => {
    setActionModal(false)
    setRecordModal(false)
    if(winCard){
      winCard.destroy()
    }
    if(roleCard){
      roleCard.destroy()
    }
  }

  if(errorPage){
    return (
      <div className="error-view FBV FBAC">
        <div className="desc mar-b20 mar-t40">房间信息读取失败或你已不在房间中</div>
        <Button className="btn-primary" onClick={quitRoom}>
          返回首页
        </Button>
      </div>
    )
  }

  return (
    <div className="room-container">
      <div className="room-wrap FBV">

        {/*websocket*/}
        <Websocket url={'ws://' + utils.getWsUrl() + ':6003/lrs/' + roomId} onMessage={wsMessage} />

        {/*header*/}
        <GameHeaderView roomDetail={roomDetail} gameDetail={gameDetail} />

        {/*游戏准备*/}
        { roomDetail.status === 0 ? <GameReadyView seat={seatInfo} roomDetail={roomDetail} /> : null }

        {/*游戏进行*/}
        { roomDetail.status === 1 ? (
          <>
            <GameContentView
              gameDetail={gameDetail}
              currentRole={currentRole}
              skillInfo={skillInfo}
              openRoleCard={openRoleCard}
              timerTime={timerTime}
              actionInfo={actionInfo}
              playerInfo={playerInfo}
              useSkill={useSkill}
              voiceRecording={voiceRecording}
              voiceSubmitting={voiceSubmitting}
              onVoiceStart={startVoiceRecord}
              onVoiceStop={stopVoiceRecord}
            />
            
            {/* 狼人聊天按钮 - 只在夜晚且是狼人时显示 */}
            {roomDetail.status === 1 && gameDetail.stage === 2 && currentRole.role === 'wolf' && (
              <div style={{position: 'fixed', top: '10px', left: '10px', zIndex: 1000, display: 'flex', gap: '8px'}}>
                <Button 
                  type="primary" 
                  danger
                  size="small"
                  onClick={() => setShowWolfChat(true)}
                  style={{boxShadow: '0 2px 8px rgba(255,77,79,0.3)'}}
                >
                  💬 文字聊天
                </Button>
                <Button 
                  type="primary" 
                  danger
                  size="small"
                  onClick={() => setShowSimpleWolfVoiceChat(true)}
                  style={{boxShadow: '0 2px 8px rgba(255,77,79,0.3)'}}
                >
                  📞 语音通话
                </Button>
              </div>
            )}

                      </>
        ) : null }

        {/*footer*/}
        <GameFooterView quitRoom={quitRoom} />

        {/*悬浮游戏按钮*/}
        <GameBtnView roomDetail={roomDetail} gameDetail={gameDetail} lookRecord={lookRecord} getRoomDetail={getRoomDetail} clearGame={clearGame} />
      </div>

      <Modal
        title="游戏事件记录"
        centered
        closable={false}
        className="modal-view-wrap game-record-modal"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={recordModal}
        footer={[
          <Button className="btn-primary" onClick={()=>{
            setGameRecord([])
            setRecordModal(false)
          }}>
            关闭
          </Button>
        ]}
      >
        <RecordView gameRecord={gameRecord} />
      </Modal>

      <Modal
        title={modalDescMap[currentAction] ? modalDescMap[currentAction].title : ''}
        centered
        closable={false}
        className="modal-view-wrap player-click-modal"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={actionModal}
        footer={[
          <Button className="btn-primary" onClick={()=>{
            setActionPlayer([])
            setActionModal(false)
            setActionResult(null)
            setCurrentAction('')
          }}>
            关闭
          </Button>
        ]}
      >
        <div className="content-wrap">
          <div className="content-view">
            {
              actionPlayer.map(item=>{
                return (
                  <div
                    className={cls({
                      'player-cell FBV FBAC FBJC': true,
                      'check-item': item.check && !item.isTarget,
                      'normal-item': !item.check && !item.isTarget,
                      'target-item': item.isTarget
                    })}
                    key={item.position}>
                    <div  className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check,
                      'mar-t20': !item.check || item.isTarget
                    })}>
                      {item.position + '号'}
                    </div>
                    <div className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check,
                      'color-red': item.isSelf
                    })}>
                      {item.name + (item.isSelf ? '(我)' : '')}
                    </div>
                    {
                      item.check && !item.isTarget ?
                        <Button size="small"
                                onClick={()=>{playerAction(item, currentAction, true)}}
                                className={modalDescMap[currentAction] ? modalDescMap[currentAction].className : ''}>
                          {modalDescMap[currentAction] ? modalDescMap[currentAction].buttonText : ''}
                        </Button> : null
                    }
                    {
                      item.roleName !== null && item.roleName !== undefined && item.roleName !== '' ? (
                        <div className={cls({
                          'camp-tag': true,
                          'bg-green': item.camp === 1,
                          'bg-red': item.camp !== 1
                        })}>
                          {item.roleName}
                        </div>
                      ) : null
                    }
                    {
                      item.camp !== null && item.camp !== undefined && currentAction === 'check' ? (
                        <div className={cls({
                          'camp-tag': true,
                          'bg-green': item.camp === 1,
                          'bg-red': item.camp !== 1
                        })}>
                          {item.camp === 1 ? '好人阵营' : '狼人阵营'}
                        </div>
                      ) : null
                    }
                  </div>
                )
              })
            }
          </div>
          {
            actionResult ? (
              <div className="result-view mar-t10 mar-l20 mar-r20">
                <div className="tit">{modalDescMap[currentAction] ? modalDescMap[currentAction].resultTitle : ''}</div>
                <div className="content FBH FBAC FBJC">
                  <div>
                    {
                      currentAction === 'check' ?  (
                        <>
                          <span className="color-green bolder">{actionResult.position + '号玩家（' + actionResult.name + ')'}</span>
                          <span>的身份是：</span>
                          <span className={cls({
                            'bolder': true,
                            'color-green': actionResult.camp === 1,
                            'color-red': actionResult.camp !== 1
                          })}>{actionResult.campName}</span>
                        </>
                      ) : (
                        <>
                          <span>{modalDescMap[currentAction] ? modalDescMap[currentAction].resultDesc : ''}</span>
                          <span className="color-red bolder">{actionResult.position + '号玩家（' + actionResult.name + ')'}</span>
                        </>
                      )
                    }
                  </div>
                </div>
              </div>
            ) : null
          }
        </div>
      </Modal>

    {/* 简化狼人语音聊天组件 */}
    <SimpleWolfVoiceChat
      visible={showSimpleWolfVoiceChat}
      onClose={() => setShowSimpleWolfVoiceChat(false)}
      roomId={roomId}
      gameId={gameDetail._id}
      userInfo={currentRole}
    />

    {/* 狼人文字聊天Modal */}
    <Modal
      title="🐺 狼人秘密聊天"
      visible={showWolfChat}
      onCancel={() => setShowWolfChat(false)}
      footer={null}
      width={500}
    >
      <div style={{height: '300px', display: 'flex', flexDirection: 'column'}}>
        {/* 消息显示区域 */}
        <div style={{flex: 1, border: '1px solid #d9d9d9', borderRadius: '4px', padding: '8px', marginBottom: '12px', overflowY: 'auto', backgroundColor: '#fafafa'}}>
          {wolfMessages.length === 0 ? (
            <div style={{textAlign: 'center', color: '#999', padding: '20px'}}>暂无消息</div>
          ) : (
            wolfMessages.map((msg, index) => (
              <div key={index} style={{marginBottom: '8px', padding: '4px 8px', backgroundColor: 'white', borderRadius: '4px'}}>
                <div style={{fontSize: '12px', color: '#666', marginBottom: '2px'}}>
                  {msg.sender} - {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <div>{msg.message}</div>
              </div>
            ))
          )}
        </div>
        
        {/* 输入区域 */}
        <div style={{display: 'flex', gap: '8px'}}>
          <Input
            value={wolfChatMessage}
            onChange={(e) => setWolfChatMessage(e.target.value)}
            onPressEnter={sendWolfMessage}
            placeholder="输入消息，按Enter发送..."
            style={{flex: 1}}
          />
          <Button type="primary" onClick={sendWolfMessage}>
            发送
          </Button>
        </div>
      </div>
    </Modal>

    
    </div>
  )
}
export default withRouter(inject('appStore')(observer(Index)))
