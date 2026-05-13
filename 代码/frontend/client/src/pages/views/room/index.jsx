import React, {useState, useEffect, useMemo, useRef} from "react";
import "./index.styl";
import Websocket from 'react-websocket';
import {inject, observer} from "mobx-react";
import {withRouter} from "react-router-dom";

import apiGame from '@api/game'
import apiRoom from '@api/room'
import apiVoice from '@api/voice'

import {Button, Input, Modal, Radio, message} from "antd";
import {
  AudioOutlined,
  BookOutlined,
  BulbOutlined,
  CrownOutlined,
  EyeOutlined,
  HomeOutlined,
  LogoutOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import GameHeaderView from "@components/game/gameHeader";
import GameFooterView from "@components/game/gameFooter";
import GameReadyView from "@components/game/gameReady";
import GameContentView from "@components/game/gameContent";
import GameBtnView from "@components/game/gameButton";
import RecordView from "@components/game/gameRecord";
import IdentityReveal from "@components/game/identityReveal";

import vote from "@assets/images/role/skill/vote.svg"
import loser from "@assets/images/shibai.svg"

import constants from "@common/constants";
import utils from '@utils'
import cls from "classnames";
import {isMockEnabled} from "@common/mock";

const { confirm, info } = Modal;
const {
  modalDescMap,
  roleCardMap,
  roleMap,
  witchSaveOptions,
  winConditionOptions,
  flatTicketOptions,
  playerCountOptions,
} = constants

const villageSquareImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB2suRmUFgwAHwsJ87LyeSx3ooFy_y-4bTkmyYI9zk5FkfJNq-OhbSk8QjNXpI-5ClWpqpPYWp6_VVx-Qr-tT3luviD56AzF0oS2Fu0myPhrI04lXsjUWiiaZor_yw9MgZYFj8UHX6DaAnYZqkLCiVvw7ZVdga4NRi-9i5jHwx81gknGV2q1b8dquA4dGTKhnFgrhkGn7sT05nxXW5140tSAd-K6Z1Kq-E0ukIi_87IsMZiafT71h0CSoMaq71QFUk9HiL7qwxt18I"
const narratorAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB8dVXn5R8gPFoigSGCZ8XqBatEYYXpeS7nOfWQaIH6xxoIqXgwyTKsB-ma2FCrSEmMq4ucb6PXawFwnMUQfrInQ5UILBrdJofipaXGq3qP3ca1FLuVreX8Ieoyhid9T2jqxltYpv8rsZnuDdN0fAPNjwzOsxGYuKvGkH4OwVXD-uprCB-vHru7htjSaDPThk_8OOB6aEl_SoyozSCHOYQ4HUcegEGPbHxnz_mM1JC84CcjAbDrpJ0chTtFmsThip_UMB-QHAdEy3c"
const playerPortraits = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAzIlNy0YOU-fQdUiaomMDgtfNswFkzdIzpEjJS0VzXp50KY2BmEPabcH0FnnSiSPT43sIpGiY3siYcXz9ciM7zhIscm-a6XpTvt1VZL27RSZ9HkzUf-R0w3i1q2l4ULtOJNvrIpeJBTsJ61HkPAxe5Ry9TrBEo5IZikhEPOOdxFD4dSZcBoTTIljJ3iTg_iit7VxAeSnqzFlsZ5lESwnuPM2FGKVND9DMYzX9P-wjV7OWgr8Y-FLI7wdnvkegcIoCNShtmfmVcIqI",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCVLyx0rTlG_4w-M3S0gcC1T9GjWeDWUErCstQHFxUNlZW33xKd4t4t0slc33EUl5-w74NQ3IQiG_6vYBQuDCB40kKz3E1xt7BLjR8Upyyd0_oeaH-voAwRVGX9J20fQ1ur6ADO8rWbt4V58gwq8t8iLNwZafhGhBSc9KfnGvcAnJmu8eu0MC1vNHL23Vcy7B2uqntVHSyZ-mCmubgZnRVvRXAjxzKvmLTwtruJulu5WNSFacoSYyAlVJVsNkXmpQEEGFr27pSoJMg",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB-FOO3HzCr_knay0Y0_llsbL_DaxPc-a_U1Q2VteLheTNyMpqFjVNZCYCtJKRlThmYtTW3MlBJyKnbJbXJw7Q6wsUgQez0FHMgRXdYoyao9TZtz4E0m-sFA_6OOexw7I1-5nke61OZI3wGO6kmR7mvgalxIkENX5ofmpuTJ2QaY33HrzxzYkX69Yz8TLk0PypCryN7tru2dYPPh4surxZbuPm8c2LDy-lUH_OdQ3jtGX-AOwfhLJ3Iaj_65eKUpdS8_FQ4pvvX4x4",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCiLX9VJD9GgqM3-jze8klswNRmVR3X6fPyfb24hKoGMQuQmI0NMi9OA9jiZMOVEXFeUem37OQDYyC4cKTgyNrO3k6aWbJvdklg-cPPy4V5zTD-bqC4OzDSl43zwR-u53BZFAm0GUaOc6a3evDQbA90t4As4TaY63W0VdJGDv1pEvJeahpvR3SvNSQWpnbCQNUMe7sWwYFm9g9jFGQudugBjTZBSsZk_Z5mueg6EFaglYtAI0ALlIq-dLJhI914mgI3tsZOp0ayMKE",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDSeoKOJ43-q_AtFIjHHiY_0nSwNoWqP6jf1xQUeiY3oZBSs5Rx6RC68aGFmWfIsDWpbQuyk9BH1GDFEVicYLxYVLrQ4WgsGSrpUayi_5IQ_aPedaTrHtlmWUQDtoXOkv0yCrGnIYS4llimH0TONfRE6c0Yx6tOPdErNuRd4hy3Kbnx98TqNLs1_KTzFna4u9MG3ogGsXGp7QE_htEX3C8K4FYlpeEYEVANTvPSk8ouboYY6LfP-zgQlD_XlV5hvf5z4c_7dcW33cs",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD1KCjD84eIQluliJHIy07PCIy5QkOYZ4oBCpM7W47iRVgStaMMAit2KTjf5dzzv7OBOZ5U_4J_hvqPx_0Fhv6OAxZGwB4F4hslImfFzkWRJ3Jjk25eVQLjtlJf6SWf6L3-BvKlGq00B3wB9qWHRT7v-eATavxzWCTfZpdNijyo9FU2YfYIOCs8QyC_MIXMYFTk8zbDSl9ZNqymEr1lVpmfaGhBS8zL87yY2S0F2c-vRJyh3kZUYZ4pW6FUa0_QyyKNo8SNR0BVv-c",
]

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

  const [errorPage, setErrorPage] = useState(false)

  const [recordModal, setRecordModal] = useState(false)
  const [gameRecord, setGameRecord] = useState([])

  const [currentAction, setCurrentAction] = useState('')
  const [actionModal, setActionModal] = useState(false)
  const [actionPlayer, setActionPlayer] = useState([])
  const [actionResult, setActionResult] = useState(null)

  const [socketOn,setSocketOn] = useState(true)
  const [roleRevealVisible, setRoleRevealVisible] = useState(false)
  const [roleRevealData, setRoleRevealData] = useState(null)
  const [winCard, setWinCard] = useState(null)

  const [timerTime, setTimerTime] = useState(null)
  const [modifyModal, setModifyModal] = useState(false)
  const [newName, setNewName] = useState(null)
  const [settingModal, setSettingModal] = useState(false)
  const [kickMode, setKickMode] = useState(false)
  const [gameSetting, setGameSetting] = useState({
    playerCount: 9,
    p1: 30,
    p2: 45,
    p3: 30,
    witchSaveSelf: 2,
    winCondition: 1,
    flatTicket: 1,
  })
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

  const isOwner = roomDetail && roomDetail.owner === user.username
  const currentRoleName = gameDetail.roleInfo ? gameDetail.roleInfo.role : null
  const canRoleNextStage =
    gameDetail.status === 1 &&
    ((gameDetail.stage === 1 && currentRoleName === "predictor") ||
      (gameDetail.stage === 2 && currentRoleName === "wolf") ||
      (gameDetail.stage === 3 && currentRoleName === "witch"))
  const canOwnerNextStage = isOwner && gameDetail.status === 1
  const canNextStage = canOwnerNextStage || canRoleNextStage
  const isDayStage = gameDetail.status === 1 && (gameDetail.dayTag === "白天" || [5, 6].includes(Number(gameDetail.stage)))
  const selectedPlayerCount = Number(gameSetting.playerCount || 9)
  const waitingPlayers = roomDetail.waitPlayer || []
  const occupiedSeatCount = seatInfo.filter(item => item.player).length
  const dayPlayerSlots = useMemo(() => {
    const playerMap = {}
    ;(playerInfo || []).forEach(item => {
      playerMap[Number(item.position)] = item
    })
    return Array.from({ length: 12 }, (_, index) => {
      const position = index + 1
      return playerMap[position] || {
        position,
        name: "空缺",
        empty: true,
        status: null,
      }
    })
  }, [playerInfo])

  const startSeatStats = useMemo(() => {
    if (!Array.isArray(seatInfo) || seatInfo.length < selectedPlayerCount) {
      return {
        canStart: false,
        humanCount: 0,
        autoAiCount: 0,
      }
    }
    const seatMap = {}
    seatInfo.forEach(item => {
      seatMap[item.key] = item
    })
    let humanCount = 0
    let autoAiCount = 0
    for (let i = 1; i <= selectedPlayerCount; i += 1) {
      if (seatMap[i] && seatMap[i].player) {
        humanCount += 1
      } else {
        autoAiCount += 1
      }
    }
    return {
      canStart: humanCount > 0,
      humanCount,
      autoAiCount,
    }
  }, [seatInfo, selectedPlayerCount])

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

  const seatIn = (position) => {
    apiRoom.seatIn({ id: roomDetail._id, position }).then(() => {
      message.success("入座成功")
      if (isMockEnabled()) {
        getRoomDetail()
      }
    })
  }

  const kickPlayer = (item) => {
    if (!item.player) {
      message.warn("该位置没有坐人，请重新操作")
      return
    }
    if (item.player.username === user.username) {
      message.warn("你不能踢自己")
      return
    }

    apiRoom.kickPlayer({ id: roomDetail._id, position: item.key }).then(() => {
      message.success("踢人成功")
      setKickMode(false)
      if (isMockEnabled()) {
        getRoomDetail()
      }
    })
  }

  const modifyName = () => {
    if (!newName || newName === "") {
      message.warn("新昵称不能为空")
      return
    }
    apiRoom.modifyNameInRoom({ id: user._id, roomId: roomDetail._id, name: newName }).then(() => {
      message.success("修改成功")
      setModifyModal(false)
      setNewName(null)
      if (isMockEnabled()) {
        getRoomDetail()
      }
    })
  }

  const startGame = () => {
    if (!startSeatStats.canStart) {
      message.warn(`前 ${selectedPlayerCount} 个座位至少需要 1 名真人玩家`)
      return
    }
    apiGame.startGame({ id: roomDetail._id, setting: gameSetting }).then(() => {
      message.success("新游戏开始")
      getRoomDetail(true)
      setGameSetting(prev => ({
        ...prev,
        p1: 30,
        p2: 45,
        p3: 30,
        witchSaveSelf: 2,
        winCondition: 1,
        flatTicket: 1,
      }))
    })
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

  const nextStage = () => {
    const params = { roomId: gameDetail.roomId, gameId: gameDetail._id }
    if (!isOwner && canRoleNextStage) {
      params.role = currentRoleName
    }

    confirm({
      title: "确定进入下一阶段吗？",
      okText: "确定",
      cancelText: "取消",
      onOk() {
        apiGame.nextStage(params).then(() => {
          message.success("操作成功！")
          getRoomDetail()
        })
      },
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
    setRoleRevealData(roleInfo || currentRole)
    setRoleRevealVisible(true)
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
    setRoleRevealVisible(false)
  }

  const getPortrait = (position) => playerPortraits[(Number(position || 1) - 1) % playerPortraits.length]

  const renderReadyModals = () => (
    <>
      <Modal
        title="修改昵称"
        centered
        className="modal-view-wrap"
        maskClosable={false}
        maskStyle={{
          backgroundColor: "rgba(0,0,0,0.1)",
        }}
        visible={modifyModal}
        onOk={modifyName}
        okText="确认"
        cancelText="取消"
        onCancel={() => {
          setModifyModal(false)
          setNewName(null)
        }}
      >
        <div>
          <div className="item-cell FBH FBAC mar-b10">
            <div className="item-title">新昵称：</div>
            <Input
              className="item-cell-content"
              placeholder="请输入新昵称"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
              }}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={<div className="setting-modal-title color-green">游戏设置</div>}
        centered
        className="modal-view-wrap"
        maskClosable={false}
        closable={false}
        width={520}
        maskStyle={{
          backgroundColor: "rgba(0,0,0,0.1)",
        }}
        visible={settingModal}
        footer={[
          <Button
            key="ok"
            className="btn-primary"
            onClick={() => {
              setSettingModal(false)
            }}
          >
            确定
          </Button>,
        ]}
      >
        <div className="settings">
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">开局人数：</div>
            <Radio.Group
              options={playerCountOptions}
              onChange={(e) => { setGameSetting({ ...gameSetting, playerCount: e.target.value }) }}
              value={gameSetting.playerCount}
              optionType="button"
              buttonStyle="solid"
            />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">预言家行动时间(秒)：</div>
            <div className="FBH FBAC FBJC">
              <MinusCircleOutlined className="icon-font mar-r20" onClick={() => { setGameSetting({ ...gameSetting, p1: (gameSetting.p1 - 15 < 15 ? 15 : gameSetting.p1 - 15) }) }} />
              <div className="fake-input">{gameSetting.p1}</div>
            </div>
            <PlusCircleOutlined className="icon-font mar-l20" onClick={() => { setGameSetting({ ...gameSetting, p1: gameSetting.p1 + 15 }) }} />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">狼人行动时间(秒)：</div>
            <div className="FBH FBAC FBJC">
              <MinusCircleOutlined className="icon-font mar-r20" onClick={() => { setGameSetting({ ...gameSetting, p2: (gameSetting.p2 - 15 < 15 ? 15 : gameSetting.p2 - 15) }) }} />
              <div className="fake-input">{gameSetting.p2}</div>
            </div>
            <PlusCircleOutlined className="icon-font mar-l20" onClick={() => { setGameSetting({ ...gameSetting, p2: gameSetting.p2 + 15 }) }} />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">女巫行动时间(秒)：</div>
            <div className="FBH FBAC FBJC">
              <MinusCircleOutlined className="icon-font mar-r20" onClick={() => { setGameSetting({ ...gameSetting, p3: (gameSetting.p3 - 15 < 15 ? 15 : gameSetting.p3 - 15) }) }} />
              <div className="fake-input">{gameSetting.p3}</div>
            </div>
            <PlusCircleOutlined className="icon-font mar-l20" onClick={() => { setGameSetting({ ...gameSetting, p3: gameSetting.p3 + 15 }) }} />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">女巫是否能自救：</div>
            <Radio.Group
              options={witchSaveOptions}
              onChange={(e) => { setGameSetting({ ...gameSetting, witchSaveSelf: e.target.value }) }}
              value={gameSetting.witchSaveSelf}
              optionType="button"
              buttonStyle="solid"
            />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">游戏胜利条件：</div>
            <Radio.Group
              options={winConditionOptions}
              onChange={(e) => { setGameSetting({ ...gameSetting, winCondition: e.target.value }) }}
              value={gameSetting.winCondition}
              optionType="button"
              buttonStyle="solid"
            />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">平票：</div>
            <Radio.Group
              options={flatTicketOptions}
              onChange={(e) => { setGameSetting({ ...gameSetting, flatTicket: e.target.value }) }}
              value={gameSetting.flatTicket}
              optionType="button"
              buttonStyle="solid"
            />
          </div>
        </div>
      </Modal>
    </>
  )

  const renderReadySeat = (item, index) => {
    const occupied = !!item.player
    return (
      <button
        key={item.key}
        className={cls({
          "ready-seat-card": true,
          "ready-seat-empty": !occupied,
          "ready-seat-kick": kickMode && occupied,
          "ready-seat-reserve": item.key > selectedPlayerCount,
        })}
        style={{
          "--seat-angle": ((index / Math.max(seatInfo.length, 1)) * 360 - 90) + "deg",
          "--seat-angle-reverse": (-((index / Math.max(seatInfo.length, 1)) * 360 - 90)) + "deg",
          "--seat-radius": "min(27vw, 260px)",
        }}
        type="button"
        onClick={() => {
          if (kickMode) {
            kickPlayer(item)
            return
          }
          if (!occupied) {
            seatIn(item.key)
          }
        }}
      >
        <div className="ready-seat-frame">
          {occupied ? (
            <img src={getPortrait(item.key)} alt="" />
          ) : (
            <div className="ready-seat-placeholder">
              <UserOutlined />
            </div>
          )}
          <span className="ready-seat-number">{item.key}号</span>
        </div>
        <div className="ready-seat-name">{occupied ? item.player.name : "空缺"}</div>
        <div className="ready-seat-note">
          {occupied ? (item.player.username === user.username ? "我已入座" : "已入座") : (item.key > selectedPlayerCount ? "备用席位" : "点击入座")}
        </div>
      </button>
    )
  }

  const renderReadyRoom = () => (
    <div className="room-ready-shell">
      {isMockEnabled() ? null : <Websocket url={'ws://' + utils.getWsUrl() + ':6003/lrs/' + roomId} onMessage={wsMessage} />}
      <div className="ready-bg" aria-hidden="true">
        <img src={villageSquareImage} alt="" />
      </div>
      <header className="ready-topbar">
        <div className="ready-brand">村落日志</div>
        <nav>
          <button type="button">游戏规则</button>
          <button type="button">世界观</button>
        </nav>
        <div className="ready-room-plaque">
          <span>房间</span>
          <strong>{roomDetail.password || roomDetail.key || roomDetail._id || "----"}</strong>
        </div>
        <div className="ready-top-actions">
          <button type="button" aria-label="音量"><AudioOutlined /></button>
          <button type="button" aria-label="设置"><SettingOutlined /></button>
        </div>
      </header>

      <aside className="ready-sidebar">
        <div className="ready-narrator">
          <img src={narratorAvatar} alt="" />
          <div>
            <strong>集结中</strong>
            <span>{roomDetail.name || "未命名房间"}</span>
          </div>
        </div>
        <nav>
          <button className="active" type="button"><HomeOutlined />广场</button>
          <button type="button"><TeamOutlined />玩家</button>
          <button type="button"><BookOutlined />规则</button>
          <button type="button"><EyeOutlined />观战</button>
        </nav>
        <div className="ready-summary">
          <div><span>已入座</span><strong>{occupiedSeatCount}/12</strong></div>
          <div><span>开局人数</span><strong>{selectedPlayerCount}人</strong></div>
          <div><span>AI补位</span><strong>{startSeatStats.autoAiCount}人</strong></div>
        </div>
        {isOwner ? (
          <button className="ready-start-btn" type="button" disabled={!startSeatStats.canStart} onClick={startGame}>
            开始游戏
          </button>
        ) : null}
        <button className="ready-side-link" type="button" onClick={quitRoom}><LogoutOutlined />离开房间</button>
      </aside>

      <main className="ready-main">
        <section className="ready-square-card">
          <div className="ready-status-banner">
            <h2>集结中</h2>
            <p>玩家正在进入村庄，房主可以安排座位并设置开局规则。</p>
          </div>
          <div className="ready-orbit">
            {seatInfo.slice(0, 12).map(item => (
              <div className={`ready-seat-slot ready-seat-slot-${item.key}`} key={item.key}>
                {renderReadySeat(item, item.key - 1)}
              </div>
            ))}
            <div className="ready-center-piece">
              <CrownOutlined />
              <strong>村庄中心</strong>
              <span>等待钟声响起</span>
            </div>
          </div>
          <div className="ready-bottom-actions">
            <button type="button" onClick={() => getRoomDetail()}><ReloadOutlined />刷新</button>
            <button type="button" onClick={() => { setNewName(""); setModifyModal(true) }}><UserOutlined />改名</button>
            {isOwner ? <button type="button" onClick={() => setSettingModal(true)}><SettingOutlined />设置</button> : null}
            {isOwner ? <button type="button" className={kickMode ? "active" : ""} onClick={() => setKickMode(!kickMode)}><BulbOutlined />{kickMode ? "取消踢人" : "踢人"}</button> : null}
          </div>
        </section>
      </main>

      <aside className="ready-right-panel">
        <section className="ready-scroll-panel">
          <div className="scroll-roll" />
          <h3>等待区</h3>
          <p className="panel-subtitle">尚未入座与观战的玩家</p>
          <div className="waiting-list">
            {waitingPlayers.length > 0 ? waitingPlayers.map((item, index) => (
              <div className="waiting-player" key={item.username || index}>
                <img src={getPortrait(index + 5)} alt="" />
                <div>
                  <strong>{item.name || item.username}</strong>
                  <span>{item.username || "guest"}</span>
                </div>
              </div>
            )) : <div className="ready-empty-text">暂无等待中的玩家</div>}
          </div>
          <div className="ready-rule-card">
            <strong>开局条件</strong>
            <span>前 {selectedPlayerCount} 个座位至少 1 名真人，缺少的 {startSeatStats.autoAiCount} 人将由 AI 自动补齐。</span>
          </div>
        </section>
      </aside>
      {renderReadyModals()}
    </div>
  )

  const renderDayPlayer = (item, index) => {
    const occupied = !item.empty
    const isDead = occupied && item.status === 0
    return (
      <button
        key={item.position}
        className={cls({
          "ready-seat-card ready-day-player": true,
          "ready-seat-empty": !occupied,
          "day-player-self": occupied && item.isSelf,
          "day-player-dead": isDead,
        })}
        type="button"
      >
        <div className="ready-seat-frame">
          {occupied ? (
            <img src={getPortrait(item.position || index + 1)} alt="" />
          ) : (
            <div className="ready-seat-placeholder">
              <UserOutlined />
            </div>
          )}
          <span className="ready-seat-number">{item.position || index + 1}号</span>
        </div>
        <div className="ready-seat-name">{occupied ? item.name : "空缺"}</div>
        <div className="ready-seat-note">
          {occupied ? (isDead ? "已出局" : (item.isSelf ? "我在场" : "在场")) : "未参局"}
        </div>
        {occupied && (item.roleName || item.campName) ? (
          <div className="day-player-tags">
            {item.roleName ? <span>{item.roleName}</span> : null}
            {item.campName ? <span>{item.campName}</span> : null}
          </div>
        ) : null}
      </button>
    )
  }

  const renderDayDiscussion = () => {
    const records = gameDetail.speechRecords || []
    return (
      <div className="day-discussion-list">
        {records.length > 0 ? records.map((item, index) => (
          <div className="day-discussion-item" key={item._id || index}>
            <div className="day-discussion-speaker">
              {item.from ? `${item.from.position || ""}号 ${item.from.name || item.from.username || "玩家"}` : "玩家"}
            </div>
            <div className="day-discussion-text">{item.text}</div>
          </div>
        )) : (
          <div className="ready-empty-text">暂无讨论记录</div>
        )}
      </div>
    )
  }

  const renderDayRoom = () => {
    const currentSpeaker = gameDetail.speechTurn && gameDetail.speechTurn.currentSpeaker
    const canSpeak =
      gameDetail.stage === 5 &&
      !gameDetail.isOb &&
      currentRole.status === 1 &&
      currentSpeaker &&
      currentSpeaker.username === currentRole.username
    const voteAction = (actionInfo || []).find(item => item.key === "vote")
    const broadcastText = (gameDetail.broadcast || []).map(item => item.text).join("")

    return (
      <div className="room-ready-shell room-day-shell">
        {isMockEnabled() ? null : <Websocket url={'ws://' + utils.getWsUrl() + ':6003/lrs/' + roomId} onMessage={wsMessage} />}
        <div className="ready-bg" aria-hidden="true">
          <img src={villageSquareImage} alt="" />
        </div>
        <header className="ready-topbar">
          <div className="ready-brand">村落日志</div>
          <nav>
            <button type="button">游戏规则</button>
            <button type="button">世界观</button>
          </nav>
          <div className="ready-room-plaque">
            <span>房间</span>
            <strong>{roomDetail.password || roomDetail.key || roomDetail._id || "----"}</strong>
          </div>
          <div className="ready-top-actions">
            <button type="button" aria-label="音量"><AudioOutlined /></button>
            <button type="button" aria-label="设置"><SettingOutlined /></button>
          </div>
        </header>

        <aside className="ready-sidebar">
          <div className="ready-narrator">
            <img src={narratorAvatar} alt="" />
            <div>
              <strong>{`第${gameDetail.day || 1}天`}</strong>
              <span>{gameDetail.stageName || "白天阶段"}</span>
            </div>
          </div>
          <nav>
            <button className="active" type="button"><HomeOutlined />广场</button>
            <button type="button"><TeamOutlined />玩家</button>
            <button type="button"><BookOutlined />行动</button>
            <button type="button" onClick={lookRecord}><EyeOutlined />日志</button>
          </nav>
          <div className="ready-summary">
            <div><span>当前阶段</span><strong>{gameDetail.dayTag || "白天"}</strong></div>
            <div><span>存活玩家</span><strong>{(playerInfo || []).filter(item => item.status !== 0).length}人</strong></div>
            <div><span>我的身份</span><strong>{currentRole.roleName || "未知"}</strong></div>
          </div>
          {currentSpeaker ? (
            <div className="ready-rule-card day-speaker-card">
              <strong>当前发言</strong>
              <span>{`${currentSpeaker.position}号 ${currentSpeaker.name}`}</span>
            </div>
          ) : null}
          {voteAction && voteAction.show ? (
            <button
              className="ready-start-btn"
              type="button"
              disabled={!voteAction.canUse}
              onClick={() => useSkill("vote")}
            >
              投出此票
            </button>
          ) : null}
          <button className="ready-side-link" type="button" onClick={quitRoom}><LogoutOutlined />离开房间</button>
        </aside>

        <main className="ready-main">
          <section className="ready-square-card">
            <div className="ready-status-banner">
              <h2>{gameDetail.dayTag || "白天"}</h2>
              <p>{broadcastText || gameDetail.stageName || "天亮了，请按顺序发言并找出狼人。"}</p>
            </div>
            <div className="ready-orbit">
              {dayPlayerSlots.map((item, index) => (
                <div className={`ready-seat-slot ready-seat-slot-${index + 1}`} key={index + 1}>
                  {renderDayPlayer(item, index)}
                </div>
              ))}
              <div className="ready-center-piece">
                <CrownOutlined />
                <strong>村庄中心</strong>
                <span>{gameDetail.stageName || "讨论中"}</span>
              </div>
            </div>
            <div className="ready-bottom-actions">
              <button type="button" onClick={() => getRoomDetail()}><ReloadOutlined />刷新</button>
              <button
                type="button"
                className={voiceRecording ? "active" : ""}
                disabled={!canSpeak || voiceSubmitting}
                onClick={() => {
                  voiceRecording ? stopVoiceRecord() : startVoiceRecord()
                }}
              >
                <AudioOutlined />{voiceRecording ? "结束发言" : "发言"}
              </button>
              <button
                type="button"
                className={voteAction && voteAction.show ? "active" : ""}
                disabled={!voteAction || !voteAction.show || !voteAction.canUse}
                onClick={() => useSkill("vote")}
              >
                <img className="day-action-icon" src={vote} alt="" />投票
              </button>
              <button type="button" onClick={lookRecord}><BookOutlined />日志</button>
              {canNextStage ? <button type="button" onClick={nextStage}><BulbOutlined />下一阶段</button> : null}
            </div>
          </section>
        </main>

        <aside className="ready-right-panel">
          <section className="ready-scroll-panel">
            <div className="scroll-roll" />
            <h3>讨论记录</h3>
            <p className="panel-subtitle">{gameDetail.dayTag || "白天"}</p>
            {renderDayDiscussion()}
            <div className="ready-rule-card">
              <strong>系统</strong>
              <span>{broadcastText || "白天讨论阶段开始。使用发言加入会议。"}</span>
            </div>
          </section>
        </aside>
      </div>
    )
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

  if(roomDetail.status === 0){
    return renderReadyRoom()
  }

  return (
    <div className="room-container">
      {isDayStage ? renderDayRoom() : (
        <div className="room-wrap FBV">

          {/*websocket*/}
          {isMockEnabled() ? null : <Websocket url={'ws://' + utils.getWsUrl() + ':6003/lrs/' + roomId} onMessage={wsMessage} />}

          {/*header*/}
          <GameHeaderView roomDetail={roomDetail} gameDetail={gameDetail} />

          {/*游戏准备*/}
          { roomDetail.status === 0 ? <GameReadyView seat={seatInfo} roomDetail={roomDetail} getRoomDetail={getRoomDetail} /> : null }

          {/*游戏进行*/}
          { roomDetail.status === 1 ? (
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
          ) : null }

          {/*footer*/}
          <GameFooterView quitRoom={quitRoom} />

          {/*悬浮游戏按钮*/}
          <GameBtnView roomDetail={roomDetail} gameDetail={gameDetail} lookRecord={lookRecord} getRoomDetail={getRoomDetail} clearGame={clearGame} />
        </div>
      )}

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

      <IdentityReveal
        visible={roleRevealVisible}
        roleInfo={roleRevealData}
        onClose={()=>{
          setRoleRevealVisible(false)
        }}
      />

    </div>
  )
}
export default withRouter(inject('appStore')(observer(Index)))
