import React, { useState, useEffect, useRef } from 'react'
import { Button, Input, message, Card } from 'antd'
import apiGame from '@api/game'
import './index.css'

const WolfVoiceChat = ({ visible, onClose, roomId, gameId, userInfo }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [messages, setMessages] = useState([])
  const [audioLevel, setAudioLevel] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)

  useEffect(() => {
    if (visible) {
      initAudioContext()
      return () => {
        cleanupAudioContext()
      }
    }
  }, [visible])

  const initAudioContext = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,  // 降低采样率减少延迟
          channelCount: 1      // 单声道减少数据量
        } 
      })
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      
      analyserRef.current.fftSize = 128  // 减小FFT大小提升响应速度
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      const updateAudioLevel = () => {
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / bufferLength
        setAudioLevel(average)
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
      }
      
      updateAudioLevel()
      
      // 设置录音器 - 优化为连续流式传输
      const options = { 
        mimeType: 'audio/webm;codecs=opus',  // 使用opus编码减少延迟
        audioBitsPerSecond: 16000           // 降低比特率
      }
      mediaRecorderRef.current = new MediaRecorder(stream, options)
      
      // 使用更短的时间间隔进行实时传输
      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          await sendAudioData(event.data)
        }
      }
      
    } catch (error) {
      console.error('初始化音频失败:', error)
      message.error('无法访问麦克风')
    }
  }

  const cleanupAudioContext = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const startRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      // 使用更短的时间间隔，实现真正的实时传输
      mediaRecorderRef.current.start(50) // 每50ms发送一次数据，更接近实时
      setIsRecording(true)
      
      // 标记开始录音
      setMessages(prev => [...prev, {
        sender: '我',
        timestamp: new Date().toLocaleTimeString(),
        isSelf: true,
        type: 'start_speaking'
      }])
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setAudioLevel(0)
      
      // 标记结束录音
      setMessages(prev => [...prev, {
        sender: '我',
        timestamp: new Date().toLocaleTimeString(),
        isSelf: true,
        type: 'stop_speaking'
      }])
    }
  }

  const sendAudioData = async (audioBlob) => {
    try {
      // 转换为base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1] // 移除data:audio/webm;base64,前缀
        
        await apiGame.sendWolfVoiceChat({
          roomId,
          gameId,
          username: userInfo.username,
          audioData: base64Audio
        })
      }
      reader.readAsDataURL(audioBlob)
    } catch (error) {
      console.error('发送音频数据失败:', error)
    }
  }

  // 处理WebSocket消息
  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'wolfVoiceChat' && 
            data.roomId === roomId && 
            data.gameId === gameId &&
            data.sender !== userInfo.username) {
          
          // 播放接收到的语音
          playReceivedAudio(data.audioData)
          
          // 添加到消息列表
          setMessages(prev => [...prev, {
            sender: data.senderName,
            timestamp: new Date(data.timestamp).toLocaleTimeString(),
            isSelf: false
          }])
        }
      } catch (error) {
        console.error('处理WebSocket消息失败:', error)
      }
    }

    if (visible) {
      window.addEventListener('message', handleWebSocketMessage)
      return () => {
        window.removeEventListener('message', handleWebSocketMessage)
      }
    }
  }, [visible, roomId, gameId, userInfo.username])

  const playReceivedAudio = async (base64Audio) => {
    try {
      // 解码base64音频
      const audioBytes = atob(base64Audio)
      const audioArray = new Uint8Array(audioBytes.length)
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i)
      }
      
      // 创建音频blob并播放
      const audioBlob = new Blob([audioArray], { type: 'audio/webm' })
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.play().catch(error => {
        console.error('播放音频失败:', error)
      })
    } catch (error) {
      console.error('处理接收音频失败:', error)
    }
  }

  const handleSelfMessage = () => {
    if (isRecording) {
      setMessages(prev => [...prev, {
        sender: '我',
        timestamp: new Date().toLocaleTimeString(),
        isSelf: true
      }])
    }
  }

  if (!visible) return null

  return (
    <div className="wolf-voice-chat-overlay">
      <Card 
        title="🐺 狼人语音聊天" 
        className="wolf-chat-card"
        extra={
          <Button type="text" onClick={onClose}>
            ✕
          </Button>
        }
      >
        {/* 通话状态指示器 */}
        <div className="call-status">
          {isRecording ? (
            <div className="speaking-indicator">
              <span className="speaking-dot"></span>
              <span>正在说话...</span>
            </div>
          ) : (
            <div className="listening-indicator">
              <span>🎤 按住说话</span>
            </div>
          )}
        </div>

        {/* 消息列表 */}
        <div className="messages-container">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`message-item ${msg.isSelf ? 'self-message' : 'other-message'} ${msg.type ? 'status-message' : ''}`}
            >
              {msg.type === 'start_speaking' ? (
                <div className="speaking-status">
                  <span className="speaker-name">{msg.sender}</span>
                  <span className="status-text">🎤 开始说话</span>
                </div>
              ) : msg.type === 'stop_speaking' ? (
                <div className="speaking-status">
                  <span className="speaker-name">{msg.sender}</span>
                  <span className="status-text">🔇 结束说话</span>
                </div>
              ) : (
                <div className="message-header">
                  <span className="sender-name">{msg.sender}</span>
                  <span className="message-time">{msg.timestamp}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 语音录制控制 */}
        <div className="voice-controls">
          <div className="audio-level-indicator">
            <div 
              className="audio-level-bar"
              style={{ 
                width: `${(audioLevel / 255) * 100}%`,
                backgroundColor: isRecording ? '#ff4d4f' : '#52c41a'
              }}
            />
          </div>
          
          <Button
            type={isRecording ? 'danger' : 'primary'}
            size="large"
            className="record-button"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
          >
            {isRecording ? '🔴 录音中...' : '🎤 按住说话'}
          </Button>
          
          <div className="voice-tips">
            <p>💡 按住按钮说话，松开发送</p>
            <p>🐺 只有狼人能看到和听到</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default WolfVoiceChat
