import React, { useState, useEffect, useRef } from 'react'
import { Button, message, Modal, Badge } from 'antd'
import './simple.css'

const SimpleWolfVoiceChat = ({ visible, onClose, roomId, gameId, userInfo }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [onlineWolves, setOnlineWolves] = useState([])
  const [currentSpeaker, setCurrentSpeaker] = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioStreamRef = useRef(null)
  const peerConnectionsRef = useRef({})

  useEffect(() => {
    if (visible) {
      initVoiceChat()
      return () => {
        cleanupVoiceChat()
      }
    }
  }, [visible])

  const initVoiceChat = async () => {
    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      
      audioStreamRef.current = stream
      setIsConnected(true)
      
      // 模拟获取在线狼人列表
      setOnlineWolves([
        { name: userInfo.name || userInfo.username, isSelf: true, isSpeaking: false },
        { name: '狼人队友1', isSelf: false, isSpeaking: false },
        { name: '狼人队友2', isSelf: false, isSpeaking: false }
      ])

      message.success('语音通话已连接')
    } catch (error) {
      console.error('初始化语音失败:', error)
      message.error('无法访问麦克风')
    }
  }

  const cleanupVoiceChat = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsConnected(false)
    setIsSpeaking(false)
  }

  const startSpeaking = () => {
    if (!audioStreamRef.current) return

    setIsSpeaking(true)
    setCurrentSpeaker(userInfo.name || userInfo.username)
    
    // 更新在线狼人状态
    setOnlineWolves(prev => prev.map(wolf => 
      wolf.isSelf ? { ...wolf, isSpeaking: true } : wolf
    ))

    // 这里可以添加实际的音频传输逻辑
    // 为了简单起见，我们使用WebSocket发送音频状态
    const speakData = {
      type: 'wolfVoiceSpeak',
      roomId,
      gameId,
      speaker: userInfo.name || userInfo.username,
      speakerUsername: userInfo.username,
      isSpeaking: true,
      timestamp: new Date().toISOString()
    }

    // 通过WebSocket发送说话状态
    if (window.ws && window.ws.readyState === 1) {
      window.ws.send(JSON.stringify(speakData))
    }
  }

  const stopSpeaking = () => {
    setIsSpeaking(false)
    setCurrentSpeaker(null)
    
    // 更新在线狼人状态
    setOnlineWolves(prev => prev.map(wolf => 
      wolf.isSelf ? { ...wolf, isSpeaking: false } : wolf
    ))

    // 发送停止说话状态
    const speakData = {
      type: 'wolfVoiceSpeak',
      roomId,
      gameId,
      speaker: userInfo.name || userInfo.username,
      speakerUsername: userInfo.username,
      isSpeaking: false,
      timestamp: new Date().toISOString()
    }

    if (window.ws && window.ws.readyState === 1) {
      window.ws.send(JSON.stringify(speakData))
    }
  }

  // 监听其他狼人的语音状态
  useEffect(() => {
    const handleVoiceMessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        
        if (data.type === 'wolfVoiceSpeak' && 
            data.roomId == roomId && 
            data.gameId == gameId &&
            data.speakerUsername !== userInfo.username) {
          
          setCurrentSpeaker(data.isSpeaking ? data.speaker : null)
          setOnlineWolves(prev => prev.map(wolf => 
            wolf.name === data.speaker 
              ? { ...wolf, isSpeaking: data.isSpeaking }
              : wolf
          ))
        }
      } catch (error) {
        console.error('处理语音消息失败:', error)
      }
    }

    if (window.ws) {
      window.ws.addEventListener('message', handleVoiceMessage)
    }

    return () => {
      if (window.ws) {
        window.ws.removeEventListener('message', handleVoiceMessage)
      }
    }
  }, [roomId, gameId, userInfo.username])

  if (!visible) return null

  return (
    <Modal
      title="🐺 狼人语音通话"
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={400}
      className="wolf-voice-modal"
    >
      <div className="voice-chat-container">
        {/* 连接状态 */}
        <div className="connection-status">
          <Badge 
            status={isConnected ? "success" : "error"} 
            text={isConnected ? "通话中" : "连接中..."} 
          />
        </div>

        {/* 在线狼人列表 */}
        <div className="wolves-list">
          <h4>在线狼人 ({onlineWolves.length})</h4>
          {onlineWolves.map((wolf, index) => (
            <div key={index} className={`wolf-item ${wolf.isSelf ? 'self-wolf' : ''} ${wolf.isSpeaking ? 'speaking' : ''}`}>
              <div className="wolf-avatar">
                <Badge status={wolf.isSpeaking ? "processing" : "default"} />
                <span className="avatar-icon">🐺</span>
              </div>
              <div className="wolf-info">
                <div className="wolf-name">
                  {wolf.name}
                  {wolf.isSelf && <span className="self-tag">我</span>}
                </div>
                {wolf.isSpeaking && (
                  <div className="speaking-indicator">
                    <span>🔊 正在说话...</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 当前说话者 */}
        {currentSpeaker && currentSpeaker !== (userInfo.name || userInfo.username) && (
          <div className="current-speaker">
            <span className="speaker-label">当前说话:</span>
            <span className="speaker-name">{currentSpeaker}</span>
          </div>
        )}

        {/* 语音控制按钮 */}
        <div className="voice-controls">
          <Button
            type={isSpeaking ? "danger" : "primary"}
            size="large"
            shape="circle"
            className={`voice-button ${isSpeaking ? 'speaking' : ''}`}
            onMouseDown={startSpeaking}
            onMouseUp={stopSpeaking}
            onTouchStart={startSpeaking}
            onTouchEnd={stopSpeaking}
            disabled={!isConnected}
          >
            {isSpeaking ? "🔴" : "🎤"}
          </Button>
          <div className="voice-tips">
            <p>按住说话，松开发送</p>
            <p>就像打电话一样简单</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default SimpleWolfVoiceChat
