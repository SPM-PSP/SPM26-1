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
  SendOutlined,
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
import predictorIdentity from "@assets/images/identity/predictor.png"
import witchIdentity from "@assets/images/identity/witch.png"
import hunterIdentity from "@assets/images/identity/hunter.png"
import villagerIdentity from "@assets/images/identity/villager.png"
import wolfIdentity from "@assets/images/identity/wolf.png"

import constants from "@common/constants";
import utils from '@utils'
import cls from "classnames";
import {isMockEnabled} from "@common/mock";

const { confirm } = Modal;
const {
  modalDescMap,
  roleMap,
  witchSaveOptions,
  winConditionOptions,
  flatTicketOptions,
  playerCountOptions,
} = constants

const villageSquareImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB2suRmUFgwAHwsJ87LyeSx3ooFy_y-4bTkmyYI9zk5FkfJNq-OhbSk8QjNXpI-5ClWpqpPYWp6_VVx-Qr-tT3luviD56AzF0oS2Fu0myPhrI04lXsjUWiiaZor_yw9MgZYFj8UHX6DaAnYZqkLCiVvw7ZVdga4NRi-9i5jHwx81gknGV2q1b8dquA4dGTKhnFgrhkGn7sT05nxXW5140tSAd-K6Z1Kq-E0ukIi_87IsMZiafT71h0CSoMaq71QFUk9HiL7qwxt18I"
const twilightVillageImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAyfeodrJpok8kMQgsIfsTaUgRzSPC6u6LJPAlHSpfU114S-ATQ3PCbtnGNLEzhx05JqKsqKjTsyxXbcLsmuhy5s_uDQy_CR4Y3zpkb1gJiNcJSlvk_Xz96gFJ_z08XbFltqDIn_extK2Dy7vv51vh7g5bSBr48ipmIFi7fcqyoenycLkeCKgW2BGFG-_FDpDWQHuwfM6y_YIZh0KO0TVD4AIeB37zEENk6dBcjGZhMhAp7alAK1a61iSlIlK5VmO_ZsCEU1dnaGCw"
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
const rolePortraitMap = {
  predictor: predictorIdentity,
  witch: witchIdentity,
  hunter: hunterIdentity,
  villager: villagerIdentity,
  wolf: wolfIdentity,
}

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
  const [nightMemoRecords, setNightMemoRecords] = useState([])
  const [duskRecordRows, setDuskRecordRows] = useState([])
  const [wolfAdvice, setWolfAdvice] = useState(null)
  const [settlementResult, setSettlementResult] = useState(null)
  const [replayLoading, setReplayLoading] = useState(false)
  const [replayReport, setReplayReport] = useState(null)
  const [replayModal, setReplayModal] = useState(false)

  const [currentAction, setCurrentAction] = useState('')
  const [actionModal, setActionModal] = useState(false)
  const [actionPlayer, setActionPlayer] = useState([])
  const [actionResult, setActionResult] = useState(null)

  const [socketOn,setSocketOn] = useState(true)
  const [roleRevealVisible, setRoleRevealVisible] = useState(false)
  const [roleRevealData, setRoleRevealData] = useState(null)

  const [timerTime, setTimerTime] = useState(null)
  const [displayTimerTime, setDisplayTimerTime] = useState(null)
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
  const [realtimeVoiceSpeaker, setRealtimeVoiceSpeaker] = useState(null)
  const [wolfChatInput, setWolfChatInput] = useState("")
  const [wolfMessages, setWolfMessages] = useState([])
  const socketRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const voiceChunksRef = useRef([])
  const voiceStreamRef = useRef(null)
  const currentVoiceScopeRef = useRef(null)
  const voiceSessionIdRef = useRef(null)
  const playedRealtimeAudioRef = useRef(new Set())
  const realtimeAudioQueueRef = useRef([])
  const realtimeAudioPlayingRef = useRef(false)
  const realtimeStreamPlayersRef = useRef({})
  const realtimeVoiceTimerRef = useRef(null)
  const roomDetailRef = useRef({})
  const gameDetailRef = useRef({})
  const socketOnRef = useRef(socketOn)
  const mountedRef = useRef(true)

  useEffect(() => {
    roomDetailRef.current = roomDetail
  }, [roomDetail])

  useEffect(() => {
    gameDetailRef.current = gameDetail
  }, [gameDetail])

  useEffect(() => {
    socketOnRef.current = socketOn
  }, [socketOn])

  const isOwner = roomDetail && (
    roomDetail.owner === user.username ||
    (currentRole.username && roomDetail.owner === currentRole.username)
  )
  const isAlivePlayer = (player) => !!player && Number(player.status) === 1
  const isOutPlayer = (player) => !!player && Number(player.status) === 0
  const currentRoleName = gameDetail.roleInfo ? gameDetail.roleInfo.role : null
  const nightStageMap = {
    0: {
      role: null,
      actionKey: null,
      title: "暗影合拢",
      subtitle: "所有人闭眼，等待村庄进入真正的夜晚。",
      nav: "幕布",
      accent: "curtain",
    },
    1: {
      role: "predictor",
      actionKey: "check",
      title: "星眼低语",
      subtitle: "预言家睁眼，选择一名玩家查验阵营。",
      nav: "预言家行动",
      accent: "seer",
    },
    2: {
      role: "wolf",
      actionKey: "assault",
      title: "暗影觉醒",
      subtitle: "狼人请睁眼，选择今晚袭击的目标。",
      nav: "狼人行动",
      accent: "wolf",
    },
    3: {
      role: "witch",
      actionKey: "poison",
      title: "药瓶轻响",
      subtitle: "女巫请睁眼，选择是否使用解药或毒药。",
      nav: "女巫行动",
      accent: "witch",
    },
  }
  const canRoleNextStage =
    gameDetail.status === 1 &&
    isAlivePlayer(currentRole) &&
    ((gameDetail.stage === 1 && currentRoleName === "predictor") ||
      (gameDetail.stage === 2 && currentRoleName === "wolf") ||
      (gameDetail.stage === 3 && currentRoleName === "witch"))
  const canOwnerNextStage = isOwner && gameDetail.status === 1
  const canNextStage = canOwnerNextStage || canRoleNextStage
  const isDayStage = gameDetail.status === 1 && (gameDetail.dayTag === "白天" || [5, 6, 6.5].includes(Number(gameDetail.stage)))
  const isNightStage = gameDetail.status === 1 && [0, 1, 2, 3].includes(Number(gameDetail.stage))
  const isDuskStage = gameDetail.status === 1 && (Number(gameDetail.stage) === 7 || gameDetail.dayTag === "黄昏")
  const isSettlementStage = [2, 3].includes(Number(gameDetail.status))
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

  useEffect(() => {
    setDisplayTimerTime(timerTime)
  }, [timerTime])

  useEffect(() => {
    const stage = Number(gameDetail.stage)
    if(![1, 2, 3].includes(stage)){
      setDisplayTimerTime(null)
      return undefined
    }
    if(displayTimerTime === null || displayTimerTime <= 0){
      return undefined
    }
    const timer = setTimeout(() => {
      setDisplayTimerTime(prev => {
        if(prev === null || prev <= 0){
          return prev
        }
        return prev - 1
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [gameDetail.stage, displayTimerTime])

  useEffect(() => () => {
    mountedRef.current = false
    if(realtimeVoiceTimerRef.current){
      clearTimeout(realtimeVoiceTimerRef.current)
    }
    if(voiceStreamRef.current){
      voiceStreamRef.current.getTracks().forEach(track => track.stop())
    }
    Object.keys(realtimeStreamPlayersRef.current).forEach(key => {
      const player = realtimeStreamPlayersRef.current[key]
      if(player && player.objectUrl){
        URL.revokeObjectURL(player.objectUrl)
      }
    })
    realtimeStreamPlayersRef.current = {}
  }, [])

  const getVoiceScope = () => {
    if(Number(gameDetail.stage) === 2 && currentRole.role === "wolf"){
      return "wolf"
    }
    if(Number(gameDetail.stage) === 7){
      return "lastWords"
    }
    return "day"
  }

  const sendSocketMessage = (payload) => {
    if(isMockEnabled() || !socketRef.current || !socketRef.current.sendMessage){
      return false
    }
    try {
      socketRef.current.sendMessage(JSON.stringify(payload))
      return true
    } catch (e) {
      return false
    }
  }

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ""))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

  const dataUrlToBlob = (dataUrl) => {
    const parts = String(dataUrl || "").split(",")
    if(parts.length < 2){
      return null
    }
    const mime = (parts[0].match(/data:(.*?);base64/) || [])[1] || "audio/webm"
    const binary = window.atob(parts[1])
    const bytes = new Uint8Array(binary.length)
    for(let i = 0; i < binary.length; i += 1){
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: mime })
  }

  const dataUrlToArrayBuffer = (dataUrl) => {
    const parts = String(dataUrl || "").split(",")
    if(parts.length < 2){
      return null
    }
    const binary = window.atob(parts[1])
    const bytes = new Uint8Array(binary.length)
    for(let i = 0; i < binary.length; i += 1){
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  const canReceiveRealtimeVoice = (data) => {
    if(!data || data.gameId !== gameDetail._id || data.sender === user.username){
      return false
    }
    if(data.scope === "wolf"){
      return currentRole.role === "wolf" && isAlivePlayer(currentRole) && Number(gameDetail.stage) === 2
    }
    if(data.scope === "lastWords"){
      return Number(gameDetail.stage) === 7
    }
    return Number(gameDetail.stage) === 5
  }

  const playNextRealtimeAudio = () => {
    if(realtimeAudioPlayingRef.current){
      return
    }
    const item = realtimeAudioQueueRef.current.shift()
    if(!item){
      return
    }
    const blob = dataUrlToBlob(item.audioData)
    if(!blob){
      playNextRealtimeAudio()
      return
    }
    realtimeAudioPlayingRef.current = true
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    const finish = () => {
      URL.revokeObjectURL(url)
      realtimeAudioPlayingRef.current = false
      playNextRealtimeAudio()
    }
    setRealtimeVoiceSpeaker(item.senderName || item.sender || "玩家")
    if(realtimeVoiceTimerRef.current){
      clearTimeout(realtimeVoiceTimerRef.current)
    }
    realtimeVoiceTimerRef.current = setTimeout(() => setRealtimeVoiceSpeaker(null), 1600)
    audio.onended = finish
    audio.onerror = finish
    audio.play().catch(finish)
  }

  const flushRealtimeStreamPlayer = (player) => {
    if(!player || !player.sourceBuffer || player.sourceBuffer.updating || player.queue.length < 1){
      return
    }
    try {
      player.sourceBuffer.appendBuffer(player.queue.shift())
    } catch (e) {
      player.queue = []
    }
  }

  const appendRealtimeAudioStream = (data) => {
    const mediaSourceApi = window.MediaSource || window.WebKitMediaSource
    const mimeType = data.mimeType || "audio/webm;codecs=opus"
    if(!mediaSourceApi || !mediaSourceApi.isTypeSupported || !mediaSourceApi.isTypeSupported(mimeType)){
      realtimeAudioQueueRef.current.push(data)
      playNextRealtimeAudio()
      return
    }

    const buffer = dataUrlToArrayBuffer(data.audioData)
    if(!buffer){
      return
    }

    const playerKey = [data.sender, data.sessionId].join(":")
    let player = realtimeStreamPlayersRef.current[playerKey]
    if(!player){
      const mediaSource = new mediaSourceApi()
      const objectUrl = URL.createObjectURL(mediaSource)
      const audio = new Audio()
      audio.autoplay = true
      audio.playsInline = true
      audio.src = objectUrl
      player = {
        audio,
        mediaSource,
        objectUrl,
        sourceBuffer: null,
        queue: [],
      }
      realtimeStreamPlayersRef.current[playerKey] = player
      mediaSource.addEventListener("sourceopen", () => {
        try {
          player.sourceBuffer = mediaSource.addSourceBuffer(mimeType)
          player.sourceBuffer.mode = "sequence"
          player.sourceBuffer.addEventListener("updateend", () => flushRealtimeStreamPlayer(player))
          flushRealtimeStreamPlayer(player)
          audio.play().catch(() => {})
        } catch (e) {
          realtimeAudioQueueRef.current.push(data)
          playNextRealtimeAudio()
        }
      }, { once: true })
    }

    player.queue.push(buffer)
    flushRealtimeStreamPlayer(player)
    player.audio.play().catch(() => {})
  }

  const receiveRealtimeAudio = (data) => {
    if(!canReceiveRealtimeVoice(data)){
      return
    }
    const key = data.chunkId || (data.sessionId + ":" + data.chunkIndex)
    if(!key || playedRealtimeAudioRef.current.has(key)){
      return
    }
    playedRealtimeAudioRef.current.add(key)
    setRealtimeVoiceSpeaker(data.senderName || data.sender || "玩家")
    if(realtimeVoiceTimerRef.current){
      clearTimeout(realtimeVoiceTimerRef.current)
    }
    realtimeVoiceTimerRef.current = setTimeout(() => setRealtimeVoiceSpeaker(null), 1600)
    appendRealtimeAudioStream(data)
  }

  const sendRealtimeVoiceChunk = (chunk) => {
    const scope = currentVoiceScopeRef.current || getVoiceScope()
    const sessionId = voiceSessionIdRef.current
    const chunkIndex = voiceChunksRef.current.length
    if(!sessionId || !chunk || chunk.size < 1){
      return
    }
    blobToBase64(chunk).then(audioData => {
      sendSocketMessage({
        type: "realtimeSpeechAudio",
        roomId: gameDetail.roomId,
        gameId: gameDetail._id,
        scope,
        sessionId,
        chunkId: sessionId + ":" + chunkIndex,
        chunkIndex,
        sender: currentRole.username || user.username,
        senderName: currentRole.name || user.name || user.username,
        mimeType: chunk.type || "audio/webm;codecs=opus",
        audioData,
        timestamp: Date.now(),
      })
    }).catch(() => {})
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
      currentVoiceScopeRef.current = getVoiceScope()
      voiceSessionIdRef.current = [
        gameDetail._id,
        currentRole.username || user.username,
        Date.now()
      ].join(":")
      const recorderOptions = window.MediaRecorder && window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus" }
        : {}
      const recorder = new MediaRecorder(stream, recorderOptions)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if(event.data && event.data.size > 0){
          voiceChunksRef.current.push(event.data)
          sendRealtimeVoiceChunk(event.data)
        }
      }
      recorder.onstop = () => {
        const audioBlob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const scope = currentVoiceScopeRef.current
        voiceChunksRef.current = []
        if(voiceStreamRef.current){
          voiceStreamRef.current.getTracks().forEach(track => track.stop())
          voiceStreamRef.current = null
        }
        if(scope === "wolf"){
          message.success("狼队实时语音已结束")
          setVoiceSubmitting(false)
          currentVoiceScopeRef.current = null
          voiceSessionIdRef.current = null
          return
        }
        submitVoiceSpeech(audioBlob)
        currentVoiceScopeRef.current = null
        voiceSessionIdRef.current = null
      }
      recorder.start(700)
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
    setVoiceSubmitting(true)
    recorder.stop()
  }

  const submitVoiceSpeech = (audioBlob) => {
    if(!audioBlob || audioBlob.size < 1){
      message.error('录音为空')
      return
    }
    setVoiceSubmitting(true)
    const isLastWords = Number(gameDetail.stage) === 7
    const speechParams = {
      roomId: gameDetail.roomId,
      gameId: gameDetail._id,
    }
    apiVoice.stt(audioBlob).then(result => {
      const text = result && result.text ? result.text : ''
      if(!text){
        return Promise.reject(new Error('未识别到发言内容'))
      }
      if(isLastWords){
        return apiGame.saveLastWords({
          ...speechParams,
          content: text,
          audioUrl: '',
          userInfo: {
            username: currentRole.username,
            name: currentRole.name,
            position: currentRole.position,
          },
        })
      }
      return apiVoice.speechText({
        ...speechParams,
        text,
      }).catch(() => apiVoice.speech(audioBlob, speechParams))
    }).then(data=>{
      const text = data && data.text ? data.text : '已保存'
      message.success((isLastWords ? '遗言已提交：' : '发言已提交：') + text)
      initGame(gameDetail._id, gameDetail.roomId)
    }).catch(error => {
      message.error(error && error.message ? error.message : (isLastWords ? '遗言提交失败' : '发言提交失败'))
    }).finally(()=>{
      setVoiceSubmitting(false)
    })
  }

  const getRoomDetail = (isBegin) => {
    apiRoom.getRoomInfo({id: roomId}).then(data=>{
      if(!mountedRef.current){
        return
      }
      roomDetailRef.current = data
      setRoomDetail(data)
      if(data.status === 0){
        initSeat(data)
      } else if (data.status === 1) {
        initGame(data.gameId, data._id, isBegin)
      }
    }).catch(error=>{
      console.log('获取房间信息失败！',error)
      const errorText = String(error || '')
      const isTransientError = errorText.indexOf('timeout') > -1 || errorText.indexOf('Network Error') > -1
      if(!mountedRef.current || isTransientError || roomDetailRef.current._id){
        return
      }
      setErrorPage(true)
    })
  }

  const initGame = (gameId, roomId, isBegin) => {
    if(!gameId){
      console.log('initGame失败：gameId不存在')
      message.warn('游戏id不存在！')
      return
    }
    return apiGame.getGameInfo({id: gameId, roomId: roomId}).then(data=>{
      const previousStage = gameDetailRef.current && gameDetailRef.current.stage
      if(previousStage !== undefined && Number(previousStage) !== Number(data.stage)){
        setTimerTime(null)
        setDisplayTimerTime(null)
      }
      gameDetailRef.current = data
      setGameDetail(data)
      setCurrentRole(data.roleInfo || {})
      setPlayerInfo(data.playerInfo || [])
      setSkillInfo(data.skill || [])
      setActionInfo(data.action || [])
      syncNightMemoRecords(data)
      syncDuskRecords(data)
      syncWolfAdvice(data)
      syncSettlementResult(data)
      if(isBegin){
        openRoleCard(data.roleInfo)
      }
    }).catch(error=>{
      console.log('发生了错误！',error)
      message.error('获取游戏信息失败，请稍后重试')
    })
  }

  const refreshCurrentGame = (isBegin) => {
    const latestRoom = roomDetailRef.current || {}
    const latestGame = gameDetailRef.current || {}
    const targetGameId = latestGame._id || latestRoom.gameId
    const targetRoomId = latestGame.roomId || latestRoom._id || roomId

    if(targetGameId && targetRoomId){
      return initGame(targetGameId, targetRoomId, isBegin)
    }

    return getRoomDetail(isBegin)
  }

  const normalizeRecordDay = (value) => {
    if(typeof value === 'number'){
      return value
    }
    const match = String(value || '').match(/\d+/)
    return match ? Number(match[0]) : null
  }

  const normalizeRecordContent = (content) => {
    if(typeof content !== "string"){
      return content || {}
    }
    try {
      return JSON.parse(content)
    } catch (e) {
      return {
        type: "text",
        text: content,
      }
    }
  }

  const flattenGameRecord = (recordMap) => {
    const rows = []
    const appendRow = (item, fallbackDay) => {
      if(!item || item.isTitle){
        return
      }
      rows.push({
        day: item.day !== undefined ? item.day : fallbackDay,
        stage: item.stage,
        content: normalizeRecordContent(item.content),
      })
    }
    if(Array.isArray(recordMap)){
      recordMap.forEach(item => {
        if(item && Array.isArray(item.content)){
          const day = normalizeRecordDay(item.key !== undefined ? item.key : item.day)
          item.content.forEach(record => appendRow(record, day))
          return
        }
        appendRow(item)
      })
      return rows
    }
    Object.keys(recordMap || {}).forEach(key => {
      const group = recordMap[key] || {}
      const day = normalizeRecordDay(group.key || key)
      const contentList = Array.isArray(group.content) ? group.content : []
      contentList.forEach(item => appendRow(item, day))
    })
    return rows
  }

  const normalizeGameRecordGroups = (data) => {
    if(Array.isArray(data)){
      const groupMap = {}
      data.slice().reverse().forEach(item => {
        if(!item){
          return
        }
        const day = normalizeRecordDay(item.day) || 0
        const key = day ? `第${day}天` : "游戏记录"
        if(!groupMap[key]){
          groupMap[key] = {
            key,
            content: [],
          }
        }
        groupMap[key].content.push(item)
      })
      return Object.keys(groupMap).map(key => groupMap[key])
    }
    let tmp = []
    for(let key in data){
      tmp.push(data[key])
    }
    return tmp
  }

  const syncNightMemoRecords = (detail) => {
    if(!detail || detail.status !== 1 || ![0, 1, 2, 3].includes(Number(detail.stage))){
      setNightMemoRecords([])
      return
    }
    apiGame.gameRecord({roomId: detail.roomId, gameId: detail._id}).then(data=>{
      setNightMemoRecords(flattenGameRecord(data))
    }).catch(()=>{
      setNightMemoRecords([])
    })
  }

  const isDuskDetail = (detail) => (
    detail &&
    detail.status === 1 &&
    (Number(detail.stage) === 7 || detail.dayTag === "黄昏")
  )

  const syncDuskRecords = (detail) => {
    if(!isDuskDetail(detail)){
      setDuskRecordRows([])
      return
    }
    apiGame.gameRecord({roomId: detail.roomId, gameId: detail._id}).then(data=>{
      setDuskRecordRows(flattenGameRecord(data))
    }).catch(()=>{
      setDuskRecordRows([])
    })
  }

  const syncWolfAdvice = (detail) => {
    if(!detail || Number(detail.stage) !== 2 || detail.isOb || !detail.roleInfo || detail.roleInfo.role !== 'wolf'){
      setWolfAdvice(null)
      return
    }
    apiGame.wolfSuggestions({roomId: detail.roomId, gameId: detail._id}).then(data=>{
      setWolfAdvice(data || null)
    }).catch(()=>{
      setWolfAdvice(null)
    })
  }

  const syncSettlementResult = (detail) => {
    if(!detail || ![2, 3].includes(Number(detail.status))){
      setSettlementResult(null)
      setReplayReport(null)
      setReplayModal(false)
      return
    }
    if(Number(detail.status) === 3){
      setSettlementResult({aborted: true})
      setReplayReport(null)
      setReplayModal(false)
      return
    }
    apiGame.gameResult({roomId: detail.roomId, gameId: detail._id}).then(data=>{
      setSettlementResult(data || {})
    }).catch(()=>{
      setSettlementResult({})
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
    setGameRecord(normalizeGameRecordGroups(data))
    setRecordModal(true)
  }

  const seatIn = (position) => {
    apiRoom.seatIn({ roomId: roomDetail._id, position }).then(() => {
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

    apiRoom.kickPlayer({ roomId: roomDetail._id, position: item.key }).then(() => {
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
    apiRoom.modifyNameInRoom({ userId: user._id, roomId: roomDetail._id, name: newName }).then(() => {
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
        const stageApi = !isOwner && canRoleNextStage ? apiGame.userNextStage : apiGame.nextStage
        stageApi(params).then(() => {
          message.success("操作成功！")
          getRoomDetail()
        })
      },
    })
  }

  const gameDestroy = () => {
    confirm({
      title: "确定要结束游戏吗？",
      okText: "确定",
      cancelText: "取消",
      onOk() {
        return apiGame.gameDestroy({roomId: gameDetail.roomId, gameId: gameDetail._id}).then(() => {
          message.success("游戏已结束")
          refreshCurrentGame()
        })
      },
    })
  }

  const renderOwnerEndGameButton = () => (
    isOwner && gameDetail.status === 1 ? (
      <button className="ready-end-btn" type="button" onClick={gameDestroy}>
        结束游戏
      </button>
    ) : null
  )

  const buildActionPlayers = (key) => {
    if(key === 'check'){
      let tmp = []
      playerInfo.forEach(item=>{
        let canCheck = true
        if(isOutPlayer(item)){
          canCheck = false
        } else if (item.isSelf){
          canCheck = false
        } else if (item.camp !== null && item.camp !== undefined){
          canCheck = false
        }
        tmp.push({...item, check: canCheck, isTarget: false})
      })
      return tmp
    }

    if(key === 'assault' || key === 'shoot' || key === 'poison' || key === 'vote'){
      let tmp = []
      playerInfo.forEach(item=>{
        let canCheck = true
        if(isOutPlayer(item)){
          canCheck = false
        }
        if(!item.isTarget){
          canCheck = false
        }
        tmp.push({...item, check: canCheck, isTarget: false})
      })
      return tmp
    }

    return null
  }

  const useSkill = (key) => {
    setCurrentAction(key)
    setActionResult(null)
    if(key === 'antidote' || key === 'boom'){
      playerAction(null, key, true)
      return
    }

    const tmp = buildActionPlayers(key)
    if(tmp){
      setActionPlayer(tmp)
      setActionModal(true)
      return;
    }

    message.error('未识别的动作！')
  }

  const startInlineAction = (key) => {
    setCurrentAction(key)
    setActionResult(null)
    setActionModal(false)

    if(key === 'antidote' || key === 'boom'){
      playerAction(null, key, true)
      return
    }

    const tmp = buildActionPlayers(key)
    if(tmp){
      setActionPlayer(tmp)
      return
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
    const result = data && typeof data === 'object' ? data : {}
    setActionResult(result)
    let newCheckPlayer = JSON.parse(JSON.stringify((actionPlayer && actionPlayer.length > 0) ? actionPlayer : playerInfo))
    let tmp = []
    newCheckPlayer.forEach(item=>{
      if(result.username && item.username === result.username){
        let obj = {...item, camp: result.camp, campName: result.campName, selected: true}
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

  const wsMessage = (msg) => {
    if(msg === 'refreshRoom'){
      if(socketOnRef.current){
        getRoomDetail()
      }
    } else if (msg === 'refreshGame') {
      refreshCurrentGame()
    } else if (msg === 'stageChange') {
      setActionPlayer([])
      setCurrentAction('')
      setActionResult(null)
      closeAllModel()
      refreshCurrentGame()
    } else if (msg === 'refreshRecord') {
      if(gameDetailRef.current && gameDetailRef.current._id){
        refreshCurrentGame()
      }
    } else if (msg === 'gameStart'){
      getRoomDetail(true)
    } else if (msg === 'gameOver') {
      const latestGame = gameDetailRef.current || {}
      apiGame.gameResult({roomId: latestGame.roomId, gameId: latestGame._id}).then(data=>{
        closeAllModel()
        setSettlementResult(data || {})
        refreshCurrentGame()
      })
    } else if (msg === 'reStart'){
      closeAllModel()
      setActionPlayer([])
      setCurrentAction('')
      setActionResult(null)
      setPlayerInfo([])
      setCurrentRole({})
      if(socketOnRef.current){
        getRoomDetail()
      }
    } else {
      let msgData = null
      try {
        msgData = JSON.parse(msg)
      } catch (e) {
        return
      }
      if(msgData && msgData.type === "realtimeSpeechAudio"){
        receiveRealtimeAudio(msgData)
        return
      }
      if(msgData && msgData.type === "wolfChat"){
        if(
          msgData.gameId === gameDetail._id &&
          currentRole.role === "wolf" &&
          isAlivePlayer(currentRole) &&
          Number(gameDetail.stage) === 2
        ){
          setWolfMessages(prev => {
            if(prev.some(item => item.messageId === msgData.messageId)){
              return prev
            }
            return prev.concat(msgData).slice(-30)
          })
        }
        return
      }
      if(msgData && msgData.type === "lastWords"){
        if(msgData.gameId === (gameDetailRef.current && gameDetailRef.current._id)){
          refreshCurrentGame()
        }
        return
      }
      if(msgData && msgData.time !== null && msgData.time !== undefined){
        setTimerTime(msgData.time)
      }
      if(msgData && msgData.type === 'realtimeSpeechText'){
        return
      }
    }
  }

  const showMockWinner = (winner) => {
    const latestGame = gameDetailRef.current || gameDetail || {}
    const latestRoom = roomDetailRef.current || roomDetail || {}
    apiGame.gameResult({
      roomId: latestGame.roomId || latestRoom._id || roomId,
      gameId: latestGame._id || latestRoom.gameId,
      winner,
    }).then(data => {
      closeAllModel()
      setSettlementResult(data || {})
      refreshCurrentGame()
    })
  }

  const closeAllModel = () => {
    setActionModal(false)
    setRecordModal(false)
    setReplayModal(false)
    setRoleRevealVisible(false)
  }

  const getPortrait = (position) => playerPortraits[(Number(position || 1) - 1) % playerPortraits.length]
  const getVisiblePlayerRole = (player) => player && (player.role || (player.isSelf ? currentRole.role : null))
  const getVisiblePlayerPortrait = (player, position) => {
    const visibleRole = getVisiblePlayerRole(player)
    return rolePortraitMap[visibleRole] || getPortrait(position)
  }

  const formatCountdown = (value) => {
    const seconds = Math.max(0, Number(value || 0))
    const minute = Math.floor(seconds / 60)
    const second = seconds % 60
    return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`
  }

  const renderRoomSocket = () => (
    isMockEnabled() ? null : (
      <Websocket
        ref={socketRef}
        url={'ws://' + utils.getWsUrl() + ':6003/lrs/' + roomId}
        onMessage={wsMessage}
        onOpen={() => {
          refreshCurrentGame()
        }}
      />
    )
  )

  const renderMockSettlementTools = () => {
    if(!isMockEnabled() || !gameDetail._id || roomDetail.status !== 1 || Number(gameDetail.status) !== 1){
      return null
    }
    return (
      <div className="mock-settlement-tools">
        <span>Mock 结算</span>
        <button type="button" onClick={() => showMockWinner(0)}>狼人胜</button>
        <button type="button" onClick={() => showMockWinner(1)}>好人胜</button>
      </div>
    )
  }

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
      {renderRoomSocket()}
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

  const getNightSkill = (key) => (skillInfo || []).find(item => item.key === key)

  const getActionLabel = (key) => {
    const labelMap = {
      check: "查验",
      assault: "袭击",
      kill: "袭击",
      antidote: "解药",
      poison: "毒药",
      jump: "空过",
    }
    return labelMap[key] || (modalDescMap[key] ? modalDescMap[key].title : "等待")
  }

  const getPrivateNightLine = (broadcastText) => {
    if(!broadcastText){
      return null
    }
    if(currentRole.role === "predictor" && broadcastText.indexOf("查验") > -1){
      return broadcastText
    }
    if(currentRole.role === "wolf" && (broadcastText.indexOf("袭击") > -1 || broadcastText.indexOf("狼人团队") > -1)){
      return broadcastText
    }
    if(currentRole.role === "witch" && (
      broadcastText.indexOf("死亡") > -1 ||
      broadcastText.indexOf("解药") > -1 ||
      broadcastText.indexOf("毒药") > -1
    )){
      return broadcastText
    }
    return null
  }

  const getPublicNightRecordLines = (day) => {
    const textMap = {
      check: "预言家读过一名玩家的身份。",
      assault: "狼人选择了一个夜晚目标。",
      kill: "狼人选择了一个夜晚目标。",
      antidote: "女巫使用了一瓶药。",
      poison: "女巫使用了一瓶药。",
      jump: "有角色选择了空过。",
    }
    const added = {}
    return (nightMemoRecords || []).reduce((list, item) => {
      const content = item.content || {}
      const key = content.key || content.action
      const itemDay = normalizeRecordDay(item.day)
      if(itemDay !== normalizeRecordDay(day) || !key || !textMap[key] || added[key]){
        return list
      }
      added[key] = true
      return list.concat(textMap[key])
    }, [])
  }

  const buildNightMemoItems = (stage, broadcastText) => {
    const items = []
    const privateLine = getPrivateNightLine(broadcastText)
    const actionLineMap = {
      check: actionResult ? `你查验了${actionResult.position}号玩家（${actionResult.name}）：${actionResult.campName || "结果已记录"}。` : null,
      assault: actionResult ? `你今晚袭击了${actionResult.position}号玩家（${actionResult.name}）。` : null,
      antidote: actionResult && actionResult.position ? `你使用解药救下了${actionResult.position}号玩家（${actionResult.name}）。` : null,
      poison: actionResult ? `你使用毒药选择了${actionResult.position}号玩家（${actionResult.name}）。` : null,
    }

    items.push("夜幕已经落下，所有玩家保持闭眼。")

    if(stage === 0){
      items.push("当前仍在幕布阶段，尚未产生夜间行动。")
    }
    if(stage >= 1){
      if(currentRole.role === "predictor" && (actionLineMap.check || privateLine)){
        items.push(actionLineMap.check || privateLine)
      } else {
        items.push(stage === 1 ? "预言家正在读一名玩家的身份。" : "预言家阶段已结束。")
      }
    }
    if(stage >= 2){
      if(currentRole.role === "wolf" && (actionLineMap.assault || privateLine)){
        items.push(actionLineMap.assault || privateLine)
      } else {
        items.push(stage === 2 ? "狼人正在选择一个夜晚目标。" : "狼人已经选择了一个夜晚目标。")
      }
    }
    if(stage >= 3){
      if(currentRole.role === "witch" && (actionLineMap.antidote || actionLineMap.poison || privateLine)){
        items.push(actionLineMap.antidote || actionLineMap.poison || privateLine)
      } else {
        items.push("女巫正在判断是否使用药剂。")
      }
    }

    getPublicNightRecordLines(gameDetail.day).forEach(text => {
      if(!items.includes(text)){
        items.push(text)
      }
    })

    return items
  }

  const getNightSystemTip = (stage) => {
    const tipMap = {
      0: {
        title: "夜幕等待阶段",
        text: "所有玩家请闭眼等待，夜晚行动即将开始。",
      },
      1: {
        title: "预言家行动阶段",
        text: "预言家请睁眼，选择一名玩家查验阵营。",
      },
      2: {
        title: "狼人行动阶段",
        text: "狼人请睁眼，选择今晚袭击的目标。",
      },
      3: {
        title: "女巫行动阶段",
        text: "女巫请查看夜间信息，并选择是否使用解药或毒药。",
      },
    }
    return tipMap[stage] || {
      title: "夜晚行动阶段",
      text: "当前行动角色请完成夜间操作，其余玩家保持等待。",
    }
  }

  const sendWolfChat = () => {
    if(currentRole.role !== "wolf" || !isAlivePlayer(currentRole) || Number(gameDetail.stage) !== 2){
      message.warn("出局玩家不能使用狼队频道")
      return
    }
    const text = wolfChatInput.trim()
    if(!text){
      return
    }
    const payload = {
      type: "wolfChat",
      roomId: gameDetail.roomId,
      gameId: gameDetail._id,
      messageId: [gameDetail._id, currentRole.username || user.username, Date.now()].join(":"),
      sender: currentRole.username || user.username,
      senderName: currentRole.name || user.name || user.username,
      text,
      timestamp: Date.now(),
    }
    if(sendSocketMessage(payload)){
      setWolfChatInput("")
    } else {
      message.error("狼队频道暂时不可用")
    }
  }

  const renderNightPlayer = (item, index, actionKey, canAct, targetMap) => {
    const actionPlayerItem = targetMap[item.username] || targetMap[item.position] || item
    const occupied = !!item.username
    const canSelect = canAct && actionKey && actionPlayerItem.check
    const isDead = occupied && isOutPlayer(item)
    const isSelected =
      actionPlayerItem.selected ||
      (actionResult && actionResult.username && actionResult.username === item.username)
    const actionDesc = modalDescMap[actionKey] || {}

    return (
      <button
        key={item.position || index}
        className={cls({
          "ready-seat-card ready-day-player night-day-player": true,
          "ready-seat-empty": !occupied,
          "night-player-empty": !occupied,
          "night-player-actionable": canSelect,
          "night-player-muted": !canSelect && canAct,
          "day-player-self": occupied && item.isSelf,
          "night-player-dead": isDead,
          "night-player-selected": isSelected,
        })}
        type="button"
        disabled={!canSelect}
        onClick={() => {
          if(!canSelect){
            return
          }
          const preparedPlayers = buildActionPlayers(actionKey) || []
          setCurrentAction(actionKey)
          setActionPlayer(preparedPlayers)
          setActionModal(false)
          playerAction(item, actionKey, true)
        }}
      >
        <div className="ready-seat-frame night-seat-frame">
          {occupied ? (
            <img
              className={getVisiblePlayerRole(item) ? "identity-portrait" : ""}
              src={getVisiblePlayerPortrait(item, item.position || index + 1)}
              alt=""
            />
          ) : (
            <div className="ready-seat-placeholder">
              <UserOutlined />
            </div>
          )}
          <span className="ready-seat-number">{item.position || index + 1}号</span>
          {isDead ? <div className="night-player-dead-mask">出局</div> : null}
          {isSelected ? <div className="night-player-selected-mark">{actionKey === "check" ? "验" : "☠"}</div> : null}
        </div>
        <div className="ready-seat-name">{occupied ? (item.name || "玩家") : "空缺"}</div>
        <div className="ready-seat-note">
          {occupied ? (isSelected ? "已选择目标" : (canSelect ? (actionDesc.buttonText || "选择") : (item.isSelf ? "我" : ""))) : "未参局"}
        </div>
        {occupied ? <div className="day-player-tags night-player-tags">
          {item.campName ? <span className={item.camp === 1 ? "good" : "wolf"}>{item.campName}</span> : null}
          {item.roleName ? <span>{item.roleName}</span> : null}
        </div> : null}
      </button>
    )
  }

  const renderNightRoom = () => {
    const stage = Number(gameDetail.stage || 0)
    const meta = nightStageMap[stage] || nightStageMap[0]
    const canAct =
      !!meta.role &&
      !gameDetail.isOb &&
      isAlivePlayer(currentRole) &&
      currentRole.role === meta.role
    const stageActionKeys = stage === 3 ? ["antidote", "poison"] : (meta.actionKey ? [meta.actionKey] : [])
    const visibleSkills = stageActionKeys
      .map(key => getNightSkill(key) || { key, name: modalDescMap[key] ? modalDescMap[key].title : key, show: false, canUse: false })
      .filter(item => item.show)
    const firstTargetSkill = visibleSkills.find(item => item.key !== "antidote" && item.key !== "boom" && item.canUse)
    const activeActionKey =
      canAct &&
      currentAction &&
      visibleSkills.some(item => item.key === currentAction && item.canUse) ?
        currentAction :
        (firstTargetSkill ? firstTargetSkill.key : null)
    const activePlayers = activeActionKey ? (actionPlayer.length > 0 && currentAction === activeActionKey ? actionPlayer : (buildActionPlayers(activeActionKey) || [])) : []
    const targetMap = {}
    activePlayers.forEach(item => {
      if(item.username){
        targetMap[item.username] = item
      }
      targetMap[item.position] = item
    })
    const broadcastText = (gameDetail.broadcast || []).map(item => item.text).join("")
    const hasNightCountdown = [1, 2, 3].includes(stage)
    const countdownTime = Number(displayTimerTime || 0)
    const countdownText = hasNightCountdown ? formatCountdown(countdownTime) : "--:--"
    const countdownStatus = hasNightCountdown ?
      (countdownTime > 0 ? "行动倒计时" : "等待阶段推进") :
      "幕布阶段"
    const nightMemoItems = buildNightMemoItems(stage, broadcastText)
    const nightSystemTip = getNightSystemTip(stage)
    const showWolfAdvice =
      currentRole.role === "wolf" &&
      isAlivePlayer(currentRole) &&
      stage === 2 &&
      wolfAdvice &&
      wolfAdvice.hasAiWolf &&
      Array.isArray(wolfAdvice.suggestions) &&
      wolfAdvice.suggestions.length > 0
    const showWolfChannel = currentRole.role === "wolf" && isAlivePlayer(currentRole) && stage === 2 && !gameDetail.isOb

    return (
      <div className={`room-ready-shell room-night-shell night-${meta.accent}`}>
        {renderRoomSocket()}
        <div className="night-bg" aria-hidden="true" />
        <header className="ready-topbar night-topbar">
          <div className="ready-brand">村落日志</div>
          <nav>
            <button type="button">游戏规则</button>
            <button type="button">世界观</button>
          </nav>
          <div className="ready-room-plaque night-room-plaque">
            <span>房间</span>
            <strong>{roomDetail.password || roomDetail.key || roomDetail._id || "----"}</strong>
          </div>
          <div className="ready-top-actions">
            <button type="button" aria-label="音量"><AudioOutlined /></button>
            <button type="button" aria-label="设置"><SettingOutlined /></button>
          </div>
        </header>

        <aside className="ready-sidebar night-sidebar">
          <div className="ready-narrator">
            <div className="ready-narrator-portrait">
              <img className={rolePortraitMap[currentRole.role] ? "identity-portrait" : ""} src={rolePortraitMap[currentRole.role] || narratorAvatar} alt="" />
            </div>
            <div>
              <strong>{`第${gameDetail.day || 0}天`}</strong>
              <span>{`第${stage + 1}阶段 ${meta.nav}`}</span>
            </div>
          </div>
          <nav>
            <button type="button"><HomeOutlined />广场</button>
            <button type="button"><TeamOutlined />玩家</button>
            <button className="active" type="button"><BookOutlined />行动</button>
            <button type="button" onClick={lookRecord}><EyeOutlined />日志</button>
          </nav>
          <div className="ready-summary">
            <div><span>当前天数</span><strong>{`第${gameDetail.day || 0}天`}</strong></div>
            <div><span>当前阶段</span><strong>{`第${stage + 1}阶段`}</strong></div>
            <div><span>阶段名称</span><strong>{meta.nav}</strong></div>
            <div><span>我的身份</span><strong>{currentRole.roleName || "未知"}</strong></div>
          </div>
          {canNextStage ? (
            <button className="ready-start-btn" type="button" onClick={nextStage}>
              下一阶段
            </button>
          ) : null}
          {renderOwnerEndGameButton()}
          <button className="ready-side-link" type="button" onClick={quitRoom}><LogoutOutlined />离开房间</button>
        </aside>

        <main className="ready-main night-main">
          <section className="ready-square-card night-square-card">
            <div className="ready-status-banner night-status-banner">
              <h2>{meta.nav}</h2>
              <p>{canAct ? (broadcastText || meta.subtitle) : nightSystemTip.text}</p>
            </div>

            <div className="ready-orbit night-orbit">
              {dayPlayerSlots.map((item, index) => (
                <div className={`ready-seat-slot ready-seat-slot-${index + 1}`} key={index + 1}>
                  {renderNightPlayer(item, index, activeActionKey, canAct, targetMap)}
                </div>
              ))}
              <div className="ready-center-piece night-center-piece">
                <BulbOutlined />
                <strong>夜晚中心</strong>
                <span>{meta.nav}</span>
              </div>
            </div>

            <section className="night-actions">
              {canAct && visibleSkills.length > 0 ? visibleSkills.map(item => {
                const isDirectAction = item.key === "antidote" || item.key === "boom"
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cls({
                      "night-action-btn": true,
                      "active": activeActionKey === item.key || isDirectAction,
                    })}
                    disabled={!item.canUse}
                    onClick={() => startInlineAction(item.key)}
                  >
                    <span>{item.key === "check" ? "查" : item.key === "assault" ? "袭" : item.key === "antidote" ? "救" : "毒"}</span>
                    <strong>{item.name}</strong>
                  </button>
                )
              }) : (
                <div className="night-curtain-note">当前不是你的行动阶段，请保持等待状态。</div>
              )}
            </section>

            {actionResult && currentAction ? (
              <section className="night-result">
                <strong>{modalDescMap[currentAction] ? modalDescMap[currentAction].resultTitle : "行动结果"}</strong>
                {currentAction === "check" ? (
                  <span>{`${actionResult.position}号 ${actionResult.name} 的阵营是：${actionResult.campName}`}</span>
                ) : actionResult.position ? (
                  <span>{`${modalDescMap[currentAction] ? modalDescMap[currentAction].resultDesc : "目标"}${actionResult.position}号 ${actionResult.name}`}</span>
                ) : (
                  <span>操作已记录，请等待阶段刷新。</span>
                )}
              </section>
            ) : null}
          </section>
        </main>

        <aside className="ready-right-panel night-right-panel">
          <section className="ready-scroll-panel night-scroll-panel">
            <div className="scroll-roll" />
            <h3>夜晚纪要</h3>
            <p className="panel-subtitle">{meta.nav}</p>
            {hasNightCountdown ? (
              <div className="night-countdown-panel">
                <span>{countdownStatus}</span>
                <strong>{countdownText}</strong>
                <p>{`${meta.nav}剩余时间`}</p>
              </div>
            ) : null}
            <div className="night-memo-list">
              {nightMemoItems.map((item, index) => (
                <div className="night-memo-item" key={item + index}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
            {showWolfChannel ? (
              <div className="wolf-chat-panel">
                <div className="wolf-chat-title">
                  <strong>狼队实时频道</strong>
                  <button
                    type="button"
                    className={voiceRecording && currentVoiceScopeRef.current === "wolf" ? "active" : ""}
                    disabled={voiceSubmitting}
                    onClick={() => {
                      voiceRecording ? stopVoiceRecord() : startVoiceRecord()
                    }}
                  >
                    <AudioOutlined />{voiceRecording && currentVoiceScopeRef.current === "wolf" ? "结束语音" : "实时语音"}
                  </button>
                </div>
                <div className="wolf-chat-list">
                  {wolfMessages.length > 0 ? wolfMessages.map(item => (
                    <div className={item.sender === (currentRole.username || user.username) ? "wolf-chat-item self" : "wolf-chat-item"} key={item.messageId}>
                      <span>{item.senderName || item.sender || "狼人"}</span>
                      <p>{item.text}</p>
                    </div>
                  )) : <div className="ready-empty-text">狼队频道暂无消息</div>}
                </div>
                <div className="wolf-chat-input">
                  <Input
                    value={wolfChatInput}
                    placeholder="输入狼队消息"
                    onChange={(e) => setWolfChatInput(e.target.value)}
                    onPressEnter={sendWolfChat}
                  />
                  <button type="button" onClick={sendWolfChat} aria-label="发送狼队消息">
                    <SendOutlined />
                  </button>
                </div>
              </div>
            ) : null}
            {realtimeVoiceSpeaker ? (
              <div className="realtime-voice-tip">
                <AudioOutlined />
                <span>{`${realtimeVoiceSpeaker} 正在实时发言`}</span>
              </div>
            ) : null}
            {showWolfAdvice ? (
              <div className="wolf-advice-panel">
                <strong>狼队 AI 建议</strong>
                {wolfAdvice.suggestions.map((item, index) => (
                  <div className="wolf-advice-item" key={item.aiId || index}>
                    <span>{item.aiId || `AI-${index + 1}`}</span>
                    <p>{item.content && item.content.speechText ? item.content.speechText : "暂无建议"}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="ready-rule-card">
              <strong>{nightSystemTip.title}</strong>
              <span>{nightSystemTip.text}</span>
            </div>
            <div className="night-side-actions">
              <button type="button" onClick={() => refreshCurrentGame()}><ReloadOutlined />刷新</button>
              <button type="button" onClick={lookRecord}><BookOutlined />查看记录</button>
            </div>
          </section>
        </aside>
      </div>
    )
  }

  const renderDayPlayer = (item, index) => {
    const occupied = !item.empty
    const isDead = occupied && isOutPlayer(item)
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
            <img
              className={getVisiblePlayerRole(item) ? "identity-portrait" : ""}
              src={getVisiblePlayerPortrait(item, item.position || index + 1)}
              alt=""
            />
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
    const isSpeechStage = Number(gameDetail.stage) === 5
    const currentSpeaker = gameDetail.speechTurn && gameDetail.speechTurn.currentSpeaker
    const canSpeak =
      isSpeechStage &&
      !gameDetail.isOb &&
      isAlivePlayer(currentRole) &&
      currentSpeaker &&
      currentSpeaker.username === currentRole.username
    const voteAction = (actionInfo || []).find(item => item.key === "vote")
    const broadcastText = (gameDetail.broadcast || []).map(item => item.text).join("")
    const speechTurnText = currentSpeaker ?
      `轮到 ${currentSpeaker.position}号 ${currentSpeaker.name || "玩家"} 发言` :
      "正在同步发言顺序，请稍候"

    return (
      <div className="room-ready-shell room-day-shell">
        {renderRoomSocket()}
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
            <div className="ready-narrator-portrait">
              <img className={rolePortraitMap[currentRole.role] ? "identity-portrait" : ""} src={rolePortraitMap[currentRole.role] || narratorAvatar} alt="" />
            </div>
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
            <div><span>存活玩家</span><strong>{(playerInfo || []).filter(item => !isOutPlayer(item)).length}人</strong></div>
            <div><span>我的身份</span><strong>{currentRole.roleName || "未知"}</strong></div>
          </div>
          {isSpeechStage ? (
            <div className="ready-rule-card day-speaker-card">
              <strong>当前发言</strong>
              <span>{speechTurnText}</span>
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
          {renderOwnerEndGameButton()}
          <button className="ready-side-link" type="button" onClick={quitRoom}><LogoutOutlined />离开房间</button>
        </aside>

        <main className="ready-main">
          <section className="ready-square-card">
            <div className="ready-status-banner">
              <h2>{gameDetail.dayTag || "白天"}</h2>
              <p>{isSpeechStage ? speechTurnText : (broadcastText || gameDetail.stageName || "天亮了，请按顺序发言并找出狼人。")}</p>
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
              <button type="button" onClick={() => refreshCurrentGame()}><ReloadOutlined />刷新</button>
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
            {realtimeVoiceSpeaker ? (
              <div className="realtime-voice-tip">
                <AudioOutlined />
                <span>{`${realtimeVoiceSpeaker} 正在实时发言`}</span>
              </div>
            ) : null}
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

  const getPlayerByRecordTarget = (target) => {
    if(!target){
      return null
    }
    return (playerInfo || []).find(item => (
      (target.username && item.username === target.username) ||
      (target.position && Number(item.position) === Number(target.position))
    )) || null
  }

  const isSamePlayer = (a, b) => {
    if(!a || !b){
      return false
    }
    return (
      (a.username && b.username && a.username === b.username) ||
      (a.position && b.position && Number(a.position) === Number(b.position))
    )
  }

  const getRecordText = (row) => {
    const content = normalizeRecordContent(row && row.content)
    if(content.text){
      return content.text
    }
    if(content.type === "rich-text"){
      return (content.content || []).map(item => item.text).join("")
    }
    return ""
  }

  const parseVoteNameCount = (name) => {
    const value = String(name || "")
    const match = value.match(/共(\d+)票/)
    if(match){
      return Number(match[1])
    }
    if(!value){
      return 0
    }
    return value.split("、").filter(Boolean).length
  }

  const getPlayerByPositionOrName = (position, name) => {
    const targetName = String(name || "").trim()
    return (playerInfo || []).find(item => (
      (position && Number(item.position) === Number(position)) ||
      (targetName && (item.name === targetName || item.username === targetName))
    )) || null
  }

  const parseExiledPlayerFromText = (text) => {
    const value = String(text || "")
    const match = value.match(/(\d+)号(?:玩家)?(?:（([^）]+)）|\(([^)]+)\))?.{0,24}(?:被投票出局|获得最高票数，?出局|被放逐|放逐出局|出局)/)
    if(!match){
      return null
    }
    const position = Number(match[1])
    const name = match[2] || match[3] || ""
    return getPlayerByPositionOrName(position, name) || {
      position,
      name: name || "玩家",
    }
  }

  const getUniqueTopVotePlayer = (rows) => {
    const validRows = (rows || []).filter(item => !item.isAbstain && item.count > 0)
    if(validRows.length < 1){
      return null
    }
    const top = validRows[0]
    const second = validRows[1]
    if(second && Number(second.count) === Number(top.count)){
      return null
    }
    return top.player || top.target || null
  }

  const buildDuskVoteSummary = () => {
    const currentDay = normalizeRecordDay(gameDetail.day)
    const dayRows = (duskRecordRows || []).filter(item => normalizeRecordDay(item.day) === currentDay)
    const broadcastText = (gameDetail.broadcast || []).map(item => item.text).join("")
    const voteRows = dayRows.filter(item => {
      const content = normalizeRecordContent(item.content)
      return content.type === "vote" || (
        content.type === "action" &&
        (content.action === "vote" || content.key === "vote" || content.actionName === "投票")
      )
    })
    const latestVoteStage = voteRows.reduce((stage, item) => {
      const value = Number(item.stage)
      return Number.isNaN(value) ? stage : Math.max(stage, value)
    }, -1)
    const latestVoteRows = latestVoteStage >= 0 ? voteRows.filter(item => Number(item.stage) === latestVoteStage) : voteRows
    const exileRow = dayRows
      .filter(item => {
        const content = item.content || {}
        return content.type === "action" && (content.actionName === "放逐" || content.action === "out")
      })
      .pop()
    const noOutRow = dayRows.find(item => {
      const text = getRecordText(item)
      return text.indexOf("没有玩家出局") > -1 || text.indexOf("无人获得") > -1 || text.indexOf("平票") > -1
    })
    const voteSummaryMap = {}
    latestVoteRows.forEach((item, index) => {
      const content = normalizeRecordContent(item.content)
      const target = content.to || {}
      const isAbstain = content.action === "abstained" || content.actionName === "弃票" || target.name === "弃票"
      const player = isAbstain ? null : getPlayerByRecordTarget(target)
      const count = content.type === "vote" ?
        (parseVoteNameCount(target.name) || parseVoteNameCount(content.from && content.from.name)) :
        1
      const key = isAbstain ? "abstained" : (target.username || target.position || target.name || `vote-${index}`)
      const voter = content.from && (content.from.name || content.from.position || content.from.username)
      if(voteSummaryMap[key]){
        voteSummaryMap[key].count += count
        if(voter){
          voteSummaryMap[key].voters = voteSummaryMap[key].voters ?
            `${voteSummaryMap[key].voters}、${voter}` :
            String(voter)
        }
        return
      }
      voteSummaryMap[key] = {
        key,
        isAbstain,
        player,
        target,
        count,
        voters: voter ? String(voter) : "",
      }
    })
    const rows = Object.keys(voteSummaryMap).map(key => voteSummaryMap[key]).sort((a, b) => {
      if(a.isAbstain !== b.isAbstain){
        return a.isAbstain ? 1 : -1
      }
      return b.count - a.count
    })
    const validTotal = rows.reduce((total, item) => item.isAbstain ? total : total + item.count, 0)
    const abstainTotal = rows.reduce((total, item) => item.isAbstain ? total + item.count : total, 0)
    const noOutText = noOutRow ? getRecordText(noOutRow) : ""
    const exileText = exileRow ? getRecordText(exileRow) : ""
    const recordExiledPlayer = exileRow && exileRow.content ? (getPlayerByRecordTarget(exileRow.content.from) || exileRow.content.from) : null
    const textExiledPlayer = parseExiledPlayerFromText(exileText || broadcastText)
    const voteExiledPlayer = noOutRow ? null : getUniqueTopVotePlayer(rows)
    const exiledPlayer = recordExiledPlayer || textExiledPlayer || voteExiledPlayer
    return {
      rows,
      validTotal,
      abstainTotal,
      exiledPlayer,
      exileText: exileText || (exiledPlayer ? broadcastText : noOutText),
      noOut: !exiledPlayer,
    }
  }

  const renderVoteMarks = (count, active) => {
    const visibleCount = Math.min(count || 0, 8)
    return (
      <div className={active ? "dusk-vote-marks active" : "dusk-vote-marks"}>
        {Array.from({ length: visibleCount }).map((_, index) => <span key={index}>!</span>)}
        {count > visibleCount ? <em>{`+${count - visibleCount}`}</em> : null}
      </div>
    )
  }

  const renderDuskVoteRow = (item, summary) => {
    const target = item.target || {}
    const player = item.player || target
    const isExiled = summary.exiledPlayer && !item.isAbstain && (
      (summary.exiledPlayer.username && player.username === summary.exiledPlayer.username) ||
      (summary.exiledPlayer.position && Number(player.position) === Number(summary.exiledPlayer.position))
    )
    const displayName = item.isAbstain ?
      "弃票" :
      `${player.position || target.position || "?"}号 ${player.name || target.name || "玩家"}`
    const subText = item.isAbstain ? "未投出有效目标" : (player.roleName || player.campName || "身份未公开")

    return (
      <div
        key={item.key}
        className={cls({
          "dusk-vote-row": true,
          "dusk-vote-exiled": isExiled,
          "dusk-vote-abstain": item.isAbstain,
        })}
      >
        <div className="dusk-vote-person">
          <div className="dusk-vote-avatar">
            {item.isAbstain ? <MinusCircleOutlined /> : <img src={getPortrait(player.position || target.position || 1)} alt="" />}
          </div>
          <div>
            <strong>{displayName}</strong>
            <span>{subText}</span>
          </div>
        </div>
        {renderVoteMarks(item.count, isExiled)}
        <div className="dusk-vote-count">{`${item.count || 0}票`}</div>
        {item.voters ? <div className="dusk-voters">{`来自：${item.voters}`}</div> : null}
      </div>
    )
  }

  const renderDuskRoom = () => {
    const stage = Number(gameDetail.stage || 0)
    const summary = buildDuskVoteSummary()
    const exiled = summary.exiledPlayer || {}
    const broadcastText = (gameDetail.broadcast || []).map(item => item.text).join("")
    const aliveCount = (playerInfo || []).filter(item => !isOutPlayer(item)).length
    const currentSpeaker = gameDetail.speechTurn && gameDetail.speechTurn.currentSpeaker
    const isSelfExiled = isSamePlayer(exiled, currentRole)
    const isSelfDead = Number(currentRole.status) === 0 || isSelfExiled
    const isCurrentLastWordsSpeaker = isSamePlayer(currentSpeaker, currentRole)
    const canLastWords =
      stage === 7 &&
      !gameDetail.isOb &&
      isSelfDead &&
      isCurrentLastWordsSpeaker
    const lastWordsTip = canLastWords ?
      "轮到你发表遗言" :
      (currentSpeaker ? `等待 ${currentSpeaker.position}号 ${currentSpeaker.name || "玩家"} 发表遗言` : (isSelfExiled ? "遗言顺序尚未同步，请刷新或等待片刻" : "仅出局玩家可发表遗言"))
    const visibleActions = []
    ;(skillInfo || []).forEach(item => {
      if(item.show){
        visibleActions.push({...item, source: "skill"})
      }
    })
    ;(actionInfo || []).forEach(item => {
      if(item.show && !visibleActions.some(action => action.key === item.key)){
        visibleActions.push({...item, source: "action"})
      }
    })
    const resultTitle = summary.noOut ? "无人被放逐" : `${exiled.position || "?"}号 ${exiled.name || "玩家"}`
    const resultText = summary.exileText || broadcastText || "投票结算完成，等待进入下一阶段。"

    return (
      <div className="room-ready-shell room-dusk-shell">
        {renderRoomSocket()}
        <div className="dusk-bg" aria-hidden="true">
          <img src={twilightVillageImage} alt="" />
        </div>
        <header className="ready-topbar dusk-topbar">
          <div className="ready-brand">村落日志</div>
          <nav>
            <button type="button">游戏规则</button>
            <button type="button">世界观</button>
          </nav>
          <div className="ready-room-plaque dusk-room-plaque">
            <span>房间</span>
            <strong>{roomDetail.password || roomDetail.key || roomDetail._id || "----"}</strong>
          </div>
          <div className="ready-top-actions">
            <button type="button" aria-label="音量"><AudioOutlined /></button>
            <button type="button" aria-label="设置"><SettingOutlined /></button>
          </div>
        </header>

        <aside className="ready-sidebar dusk-sidebar">
          <div className="ready-narrator dusk-narrator">
            <div className="ready-narrator-portrait">
              <img className={rolePortraitMap[currentRole.role] ? "identity-portrait" : ""} src={rolePortraitMap[currentRole.role] || narratorAvatar} alt="" />
            </div>
            <div>
              <strong>{`第${gameDetail.day || 1}天`}</strong>
              <span>{`${gameDetail.dayTag || "黄昏"} - 第${stage + 1}阶段`}</span>
            </div>
          </div>
          <nav>
            <button type="button"><HomeOutlined />白天阶段</button>
            <button type="button"><BulbOutlined />夜晚阶段</button>
            <button className="active" type="button"><CrownOutlined />黄昏审判</button>
            <button type="button" onClick={lookRecord}><BookOutlined />村庄记录</button>
            <button type="button"><TeamOutlined />玩家名单</button>
          </nav>
          <div className="ready-summary dusk-summary">
            <div><span>当前天数</span><strong>{`第${gameDetail.day || 1}天`}</strong></div>
            <div><span>当前阶段</span><strong>{`第${stage + 1}阶段`}</strong></div>
            <div><span>阶段名称</span><strong>{gameDetail.stageName || "放逐结算"}</strong></div>
            <div><span>存活玩家</span><strong>{`${aliveCount}人`}</strong></div>
          </div>
          {renderOwnerEndGameButton()}
          <button className="ready-side-link" type="button" onClick={quitRoom}><LogoutOutlined />离开房间</button>
        </aside>

        <main className="ready-main dusk-main">
          <section className="dusk-stage-heading">
            <div className="dusk-kicker">
              <CrownOutlined />
              <span>黄昏阶段 · 投票结算与放逐公布</span>
            </div>
            <h2>审判阶段结束</h2>
            <p>{broadcastText || "票型已经归档，村庄等待最后的结算与下一次钟声。"}</p>
          </section>

          <section className="dusk-grid">
            <div className="dusk-result-panel">
              <div className="dusk-portrait-wrap">
                <div className={summary.noOut ? "dusk-exile-portrait dusk-noout-portrait" : "dusk-exile-portrait"}>
                  {summary.noOut ? <UserOutlined /> : <img src={getPortrait(exiled.position || 1)} alt="" />}
                  {summary.noOut ? null : <div className="dusk-exile-stamp">出局</div>}
                </div>
                {summary.noOut ? null : <span className="dusk-exile-number">{`${exiled.position || "?"}号`}</span>}
              </div>
              <h3>{resultTitle}</h3>
              <p>{resultText}</p>
              <div className="dusk-result-tags">
                {summary.noOut ? <span>没有玩家出局</span> : <span>{exiled.roleName || "身份未公开"}</span>}
                {!summary.noOut && exiled.campName ? <span>{exiled.campName}</span> : null}
              </div>
            </div>

            <div className="dusk-vote-panel">
              <div className="dusk-panel-title">
                <div><BookOutlined /><strong>计票表</strong></div>
                <span>{`有效票：${summary.validTotal}`}</span>
              </div>
              <div className="dusk-vote-list">
                {summary.rows.length > 0 ? summary.rows.map(item => renderDuskVoteRow(item, summary)) : (
                  <div className="dusk-empty-record">暂无公开票型记录，可通过“查看记录”确认完整事件。</div>
                )}
              </div>
              <div className="dusk-vote-footer">
                <span>{`弃票：${summary.abstainTotal}票`}</span>
                <span>{`阶段：${gameDetail.stageName || "放逐结算"}`}</span>
              </div>
            </div>
          </section>

          <section className="dusk-action-bar">
            <div className="dusk-action-left">
              <button type="button" onClick={() => refreshCurrentGame()}><ReloadOutlined />刷新</button>
              <button type="button" onClick={lookRecord}><BookOutlined />查看记录</button>
              <button
                type="button"
                className={voiceRecording ? "active" : ""}
                disabled={!canLastWords || voiceSubmitting}
                onClick={() => {
                  voiceRecording ? stopVoiceRecord() : startVoiceRecord()
                }}
              >
                <AudioOutlined />{voiceRecording ? "结束遗言" : "遗言"}
              </button>
              <span className={canLastWords ? "dusk-voice-status active" : "dusk-voice-status"}>
                {lastWordsTip}
              </span>
              {visibleActions.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className="active"
                  disabled={!item.canUse}
                  onClick={() => useSkill(item.key)}
                >
                  <BulbOutlined />{item.name}
                </button>
              ))}
            </div>
            {canOwnerNextStage ? (
              <button className="dusk-next-btn" type="button" onClick={nextStage}>
                进入夜晚 <span>→</span>
              </button>
            ) : null}
          </section>
        </main>

        <aside className="ready-right-panel dusk-right-panel">
          <section className="ready-scroll-panel dusk-scroll-panel">
            <div className="scroll-roll" />
            <h3>发言记录</h3>
            <p className="panel-subtitle">{gameDetail.dayTag || "黄昏"}</p>
            {realtimeVoiceSpeaker ? (
              <div className="realtime-voice-tip">
                <AudioOutlined />
                <span>{`${realtimeVoiceSpeaker} 正在实时遗言`}</span>
              </div>
            ) : null}
            {renderDayDiscussion()}
            {currentSpeaker ? (
              <div className="ready-rule-card">
                <strong>当前遗言</strong>
                <span>{`${currentSpeaker.position}号 ${currentSpeaker.name}`}</span>
              </div>
            ) : null}
            <div className="ready-rule-card">
              <strong>系统</strong>
              <span>{broadcastText || resultText}</span>
            </div>
          </section>
        </aside>
      </div>
    )
  }

  const loadReplayReport = () => {
    if(replayLoading || !gameDetail._id){
      return
    }
    if(Number(gameDetail.status) !== 2){
      message.info("本局由房主结束，暂无胜负复盘报告")
      return
    }
    setReplayLoading(true)
    apiGame.gameReplay({gameId: gameDetail._id}).then(data => {
      const result = (data && data.result) || data || {}
      const gameRecordDetail = result.gameRecord || result.game_record || {}
      const analysisFiles = result.analysisFiles || result.analysis_files || {}
      const reportText = result.analysisText || result.analysis || result.report || ""
      const filePath = analysisFiles.text || analysisFiles.path || result.textPath || result.path
      setReplayReport({
        gameRecord: gameRecordDetail,
        analysisFiles,
        text: typeof reportText === "string" ? reportText : JSON.stringify(reportText, null, 2),
        raw: result,
      })
      setReplayModal(true)
      message.success((data && data.message) || "复盘分析完成")
      if(!filePath){
        return null
      }
      const encodedPath = encodeURIComponent(filePath)
      return fetch(`/api/game/replay/file?file=${encodedPath}&path=${encodedPath}`)
        .then(response => response.text())
        .then(text => {
          setReplayReport(prev => ({
            ...prev,
            text,
          }))
        })
        .catch(() => null)
    }).catch(error => {
      message.error("复盘分析请求失败：" + (error.message || error))
    }).finally(() => {
      setReplayLoading(false)
    })
  }

  const gameAgainFromSettlement = () => {
    confirm({
      title: "确定要在当前房间再开一局吗？",
      okText: "确定",
      cancelText: "取消",
      onOk() {
        return apiGame.gameAgain({roomId: gameDetail.roomId}).then(() => {
          message.success("已返回等待区，可以准备下一局")
          closeAllModel()
          setSettlementResult(null)
          setReplayReport(null)
          setReplayModal(false)
          setGameDetail({})
          gameDetailRef.current = {}
          getRoomDetail()
        })
      },
    })
  }

  const renderSettlementRoom = () => {
    const result = settlementResult || {}
    const isAborted = Number(gameDetail.status) === 3 || result.aborted
    const hasWinner = result.winner !== undefined && result.winner !== null && [0, 1].includes(Number(result.winner))
    const winner = hasWinner ? Number(result.winner) : null
    const winnerName = isAborted ? "未产生胜负" : (result.winnerString || (winner === 0 ? "狼人阵营" : (winner === 1 ? "好人阵营" : "结算中")))
    const isPlayer = !gameDetail.isOb && currentRole && currentRole.username
    const selfWon = isPlayer && hasWinner && Number(currentRole.camp) === winner
    const aliveCount = (playerInfo || []).filter(item => !isOutPlayer(item)).length
    const winnerPlayers = hasWinner ? (playerInfo || []).filter(item => Number(item.camp) === winner).length : 0
    const roster = (playerInfo || []).slice().sort((a, b) => Number(a.position) - Number(b.position))
    const settlementText = isAborted ?
      "房主已结束本局，本局不产生胜利阵营；玩家可以在当前房间重新准备下一局。" :
      (hasWinner ?
      `${winnerName}赢得了这场对局，所有身份与终局状态已经归档。` :
      "游戏已经结束，正在读取最终结算结果。")
    const selfResultText = isAborted ?
      "本局提前结束，没有胜负结果。" :
      (!isPlayer ?
      "你以观战者身份见证了本局终幕。" :
      (hasWinner ? (selfWon ? "你赢得了本局游戏。" : "很遗憾，你未能赢得本局游戏。") : "正在确认你的结算结果。"))
    return (
      <div className="room-ready-shell room-dusk-shell room-settlement-shell">
        {renderRoomSocket()}
        <div className="dusk-bg settlement-bg" aria-hidden="true">
          <img src={twilightVillageImage} alt="" />
        </div>
        <header className="ready-topbar dusk-topbar">
          <div className="ready-brand">村落日志</div>
          <nav>
            <button type="button">游戏规则</button>
            <button type="button">世界观</button>
          </nav>
          <div className="ready-room-plaque dusk-room-plaque">
            <span>房间</span>
            <strong>{roomDetail.password || roomDetail.key || roomDetail._id || "----"}</strong>
          </div>
          <div className="ready-top-actions">
            <button type="button" aria-label="音量"><AudioOutlined /></button>
            <button type="button" aria-label="设置"><SettingOutlined /></button>
          </div>
        </header>

        <aside className="ready-sidebar dusk-sidebar">
          <div className="ready-narrator dusk-narrator">
            <div className="ready-narrator-portrait">
              <img className={rolePortraitMap[currentRole.role] ? "identity-portrait" : ""} src={rolePortraitMap[currentRole.role] || narratorAvatar} alt="" />
            </div>
            <div>
              <strong>终局</strong>
              <span>{winnerName}</span>
            </div>
          </div>
          <nav>
            <button type="button"><HomeOutlined />白天阶段</button>
            <button type="button"><BulbOutlined />夜晚阶段</button>
            <button type="button"><CrownOutlined />黄昏审判</button>
            <button className="active" type="button"><CrownOutlined />游戏结算</button>
            <button type="button" onClick={loadReplayReport}><BookOutlined />复盘报告</button>
          </nav>
          <div className="ready-summary dusk-summary">
            <div><span>游戏状态</span><strong>已结束</strong></div>
            <div><span>胜利阵营</span><strong>{winnerName}</strong></div>
            <div><span>存活玩家</span><strong>{`${aliveCount}人`}</strong></div>
            <div><span>我的身份</span><strong>{currentRole.roleName || "观战者"}</strong></div>
          </div>
          <button className="ready-side-link" type="button" onClick={quitRoom}><LogoutOutlined />离开房间</button>
        </aside>

        <main className="ready-main dusk-main settlement-main">
          <section className="dusk-stage-heading">
            <div className="dusk-kicker">
              <CrownOutlined />
              <span>{isAborted ? "终局阶段 · 对局已终止" : "终局阶段 · 游戏结算与身份公布"}</span>
            </div>
            <h2>游戏结算</h2>
            <p>{settlementText}</p>
          </section>

          <section className="dusk-grid settlement-grid">
            <div className="dusk-result-panel settlement-result-panel">
              <div className="settlement-winner-portrait">
                {hasWinner ? <img src={winner === 0 ? wolfIdentity : villagerIdentity} alt="" /> : <UserOutlined />}
                {hasWinner ? <div className="settlement-victory-stamp">胜利</div> : null}
              </div>
              <h3>{winnerName}</h3>
              <p>{selfResultText}</p>
              <div className="dusk-result-tags">
                {isPlayer ? <span>{currentRole.roleName || "身份未知"}</span> : <span>观战者</span>}
                {isAborted ? <span>无胜负</span> : (hasWinner ? <span>{selfWon ? "获胜" : (isPlayer ? "落败" : "对局结束")}</span> : <span>读取结果中</span>)}
              </div>
            </div>

            <div className="dusk-vote-panel settlement-roster-panel">
              <div className="dusk-panel-title">
                <div><TeamOutlined /><strong>终局名单</strong></div>
                <span>{isAborted ? "身份已公开" : (hasWinner ? `胜方人数：${winnerPlayers}` : "结算同步中")}</span>
              </div>
              <div className="settlement-roster">
                {roster.length > 0 ? roster.map(player => {
                  const isWinningCamp = hasWinner && Number(player.camp) === winner
                  return (
                    <div key={player.username || player.position} className={cls({"settlement-player": true, winner: isWinningCamp, out: isOutPlayer(player)})}>
                      <img src={getVisiblePlayerPortrait(player, player.position)} alt="" />
                      <div>
                        <strong>{`${player.position}号 ${player.name || "玩家"}`}</strong>
                        <span>{player.roleName || roleMap[player.role] || player.campName || "身份未公开"}</span>
                      </div>
                      <em>{isWinningCamp ? "胜利" : (isOutPlayer(player) ? "出局" : "存活")}</em>
                    </div>
                  )
                }) : <div className="dusk-empty-record">正在读取终局玩家信息...</div>}
              </div>
            </div>
          </section>

          <section className="dusk-action-bar settlement-actions">
            <div className="dusk-action-left">
              <button type="button" onClick={() => refreshCurrentGame()}><ReloadOutlined />刷新结算</button>
              <button type="button" className="active" disabled={replayLoading || isAborted} onClick={loadReplayReport}>
                <BookOutlined />{isAborted ? "暂无复盘" : (replayLoading ? "分析中..." : "复盘")}
              </button>
            </div>
            {isOwner ? (
              <button className="dusk-next-btn settlement-again-btn" type="button" onClick={gameAgainFromSettlement}>
                再来一局 <span>→</span>
              </button>
            ) : <span className="settlement-wait-owner">等待房主发起下一局</span>}
          </section>
        </main>

        <aside className="ready-right-panel dusk-right-panel">
          <section className="ready-scroll-panel dusk-scroll-panel">
            <div className="scroll-roll" />
            <h3>发言记录</h3>
            <p className="panel-subtitle">终局回顾</p>
            {renderDayDiscussion()}
            <div className="ready-rule-card">
              <strong>系统</strong>
              <span>{settlementText}</span>
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
      {isSettlementStage ? renderSettlementRoom() : isNightStage ? renderNightRoom() : isDuskStage ? renderDuskRoom() : isDayStage ? renderDayRoom() : (
        <div className="room-wrap FBV">

          {/*websocket*/}
          {renderRoomSocket()}

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

      {renderMockSettlementTools()}

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
          <Button key="close" className="btn-primary" onClick={()=>{
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
        title="复盘报告"
        centered
        closable={false}
        width={760}
        className="modal-view-wrap settlement-report-modal"
        maskClosable={false}
        visible={replayModal}
        footer={[
          <Button key="close" className="btn-primary" onClick={() => setReplayModal(false)}>
            关闭
          </Button>
        ]}
      >
        {replayReport ? (
          <>
            <div className="settlement-report-meta">
              <span>{`游戏天数：${(replayReport.gameRecord && replayReport.gameRecord.days) || gameDetail.day || "-"}`}</span>
              <span>{`胜利阵营：${settlementResult && settlementResult.winnerString ? settlementResult.winnerString : "未知"}`}</span>
            </div>
            <pre className="settlement-report-text">
              {replayReport.text || JSON.stringify(replayReport.raw || {}, null, 2) || "复盘结果已生成，暂无文字报告。"}
            </pre>
          </>
        ) : null}
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
          <Button key="close" className="btn-primary" onClick={()=>{
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
                      currentAction === 'check' && actionResult.position ?  (
                        <>
                          <span className="color-green bolder">{actionResult.position + '号玩家（' + actionResult.name + ')'}</span>
                          <span>的身份是：</span>
                          <span className={cls({
                            'bolder': true,
                            'color-green': actionResult.camp === 1,
                            'color-red': actionResult.camp !== 1
                          })}>{actionResult.campName}</span>
                        </>
                      ) : actionResult.position ? (
                        <>
                          <span>{modalDescMap[currentAction] ? modalDescMap[currentAction].resultDesc : ''}</span>
                          <span className="color-red bolder">{actionResult.position + '号玩家（' + actionResult.name + ')'}</span>
                        </>
                      ) : (
                        <span>操作已记录，请等待阶段刷新。</span>
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
