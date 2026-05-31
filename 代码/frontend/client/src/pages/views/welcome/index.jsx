import React, {useEffect, useState} from "react";
import "./index.styl";
import {inject, observer} from "mobx-react";
import {withRouter} from "react-router-dom";
import apiUser from '@api/user'
import apiRoom from '@api/room'
import apiGame from '@api/game'
import {Modal, Input, Radio, message} from "antd";
import {
  BookOutlined,
  EyeOutlined,
  LoginOutlined,
  LogoutOutlined,
  PlusCircleFilled,
  StarFilled,
} from '@ant-design/icons'
import helper from '@helper'
import {isMockEnabled} from '@common/mock'
import loginImage from '@assets/images/login.jpg'

const ambientImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDTprKn8FUcolWLiiCjptxHgZ_mEeN6w98ajveTjSwhHkCavgVAKIeG0i_Sin4W7fSP59-4Ux8MVwY5f485UBfNN42bif9FZhkEr9C3I8ox2bw7gNnIr5LExnyHkjMcBw5I0EQWY_y7ycg2sIftmauVb__nFRaH2KGC8bF8_us5gmrNzkY8miFdLL5H-iQnzGWkIZuxAt7lWkzwrFOG1HprCGQekjWD49xDhCNqUVKrSI7aJykTa8A00WAukSo_rRs3NTCrZ2hUL3o'

const roleColorMap = {
  predictor: '#93c5fd',
  witch: '#c084fc',
  hunter: '#facc15',
  wolf: '#f87171',
  villager: '#d1d5db',
}

const formatReplayDate = (value) => {
  if(!value){
    return '日期未知'
  }
  const date = new Date(value)
  if(Number.isNaN(date.getTime())){
    return '日期未知'
  }
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const getReplayTone = (item) => {
  if(item && item.isWin === true){
    return 'success'
  }
  if(item && item.isWin === false){
    return 'danger'
  }
  return 'neutral'
}

const getReplayColors = (item) => {
  const player = item.player || {}
  return [
    Number(player.camp) === 0 ? '#f87171' : '#34d399',
    roleColorMap[player.role] || '#fde68a',
    item.isWin ? '#d7eaab' : '#ffdad7',
  ]
}

const getReplaySummary = (item) => {
  const player = item.player || {}
  const roleName = player.roleName || '未知身份'
  const playerCount = item.playerCount ? `${item.playerCount}人局` : '一局游戏'
  const days = item.days ? `持续 ${item.days} 天` : '天数未知'
  const result = item.winnerLabel ? `${item.winnerLabel}获胜` : '胜负未记录'
  return `你以${roleName}身份参与了${playerCount}，${days}，${result}。`
}

const Index = (props) => {
  const {appStore, history} = props;
  const {user, logout} = appStore
  const mockOn = isMockEnabled()

  const [createUserModal, setCreateUserModal] = useState(false)
  const [newPlayer, setNewPlayer] = useState({})

  const [newRoom, setNewRoom] = useState(mockOn ? '雾中窥影体验房' : '')
  const [roomKey, setRoomKey] = useState(mockOn ? 'MOCK' : '')
  const [observeKey, setObserveKey] = useState(mockOn ? 'MOCK' : '')
  const [actionLoading, setActionLoading] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyList, setHistoryList] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [replayModal, setReplayModal] = useState(false)
  const [replayLoading, setReplayLoading] = useState(false)
  const [replayDetail, setReplayDetail] = useState(null)

  const playerType = [
    {
      label: '房主',
      value: 'host',
    },
    {
      label: '普通玩家',
      value: 'player'
    }
  ]

  const createUser = () => {
    if(!newPlayer.username || newPlayer.username === ''){
      message.warning('账号不能为空！')
      return
    }
    if(!newPlayer.name || newPlayer.name === ''){
      message.warning('昵称不能为空！')
      return
    }
    if(!newPlayer.password || newPlayer.password === ''){
      message.warning('密码不能为空！')
      return
    }
    if(!newPlayer.role || newPlayer.role === ''){
      message.warning('玩家类型不能为空！')
      return
    }
    apiUser.createUser(newPlayer).then(()=>{
      setNewPlayer({})
      setCreateUserModal(false)
      message.success('创建成功！')
    }).catch(() => {})
  }

  const createRoom = async () => {
    const roomName = (newRoom || '').trim()
    if(!roomName){
      message.warning('房间名字不能为空！')
      return
    }
    setActionLoading('create')
    try {
      const data = await apiRoom.createRoom({roomName})
      message.success('创建房间成功！')
      history.push({pathname: '/room', state: {id: data._id}})
    } catch (e) {
    } finally {
      setActionLoading('')
    }
  }

  const joinRoom = async () => {
    const key = (roomKey || '').trim()
    if(!key){
      message.warning('房间密码不能为空！')
      return
    }
    setActionLoading('join')
    try {
      const data = await apiRoom.joinRoom({key})
      message.success('加入房间成功！')
      history.push({pathname: '/room', state: {id: data}})
    } catch (e) {
    } finally {
      setActionLoading('')
    }
  }

  const obGame = async () => {
    const key = (observeKey || '').trim()
    if(!key){
      message.warning('房间密码不能为空！')
      return
    }
    setActionLoading('observe')
    try {
      const data = await apiGame.obGame({key})
      message.success('进入观战成功！')
      history.push({pathname: '/room', state: {id: data}})
    } catch (e) {
    } finally {
      setActionLoading('')
    }
  }

  const logoutAction = () => {
    logout()
  }

  const loadReplayHistory = () => {
    setHistoryLoading(true)
    apiGame.playerReplayHistory({ page: 1, limit: 20 }).then(data => {
      setHistoryList(Array.isArray(data.list) ? data.list : [])
      setHistoryTotal(Number(data.total || 0))
    }).catch(() => {
      setHistoryList([])
      setHistoryTotal(0)
    }).finally(() => {
      setHistoryLoading(false)
    })
  }

  const openReplayDetail = (item) => {
    if(!item.hasReplay){
      message.info('这一局暂无复盘详情')
      return
    }
    setReplayModal(true)
    setReplayLoading(true)
    setReplayDetail(null)
    apiGame.replayDetail({ gameId: item.gameId }).then(data => {
      setReplayDetail(data || null)
    }).finally(() => {
      setReplayLoading(false)
    })
  }

  useEffect(() => {
    loadReplayHistory()
  }, [])

  return (
    <div className="welcome-container">
      <div className="welcome-bg" aria-hidden="true">
        <img src={ambientImage} alt="" />
      </div>

      <header className="welcome-topbar">
        <div className="welcome-brand">雾中窥影</div>
        <div className="welcome-top-actions">
          {
            helper.hasCPermission('system.admin', appStore) ? (
              <button
                className="welcome-account"
                type="button"
                onClick={()=>{
                  setNewPlayer({
                    username: '',
                    name: '玩家',
                    password: '1',
                    role:'player'
                  })
                  setCreateUserModal(true)
                }}
              >
                创建玩家
              </button>
            ) : null
          }
          <button className="welcome-account" type="button" onClick={logoutAction}>
            <LogoutOutlined />
            {user.name || user.username || '退出'}
          </button>
        </div>
      </header>

      <main className="welcome-main">
        <section className="welcome-hero-board">
          <div className="wooden-sign">
            <span className="sign-rope sign-rope-left" />
            <span className="sign-rope sign-rope-right" />
            <h1>雾中窥影</h1>
            <p>这里的每一句低语都会留下痕迹。</p>
          </div>
        </section>

        <section className="welcome-content-grid">
          <div className="storybook-card">
            <div className="storybook-copy">
              <span className="story-chip">简介</span>
              <h2>迷雾森林的守望者</h2>
              <div className="storybook-art">
                <img src={loginImage} alt="misty werewolf village" />
              </div>
              <div className="story-body">
                <p>在古老而神秘的迷雾森林深处，一座宁静的村庄正面临前所未有的危机。</p>
                <p>每当夜幕降临，潜伏于黑暗中的狼人便会悄然行动。他们伪装成人类的模样，混入村民之间，等待时机逐个猎杀无辜者。而村庄中的预言家、女巫、猎人等特殊角色，也在用自己的能力守护光明。</p>
                <p>在这里，谎言与真相交织，推理与伪装并存。</p>
                <p>你需要倾听每一句发言，分析每一个细节，在有限的信息中寻找隐藏的狼人；也可能化身狼人，在众人的怀疑中隐藏身份，引导局势走向自己希望的方向。</p>
                <p>而这一次，你并非独自面对挑战。村庄中活跃着拥有独立思考能力的 AI 玩家，他们会观察、推理、质疑、辩护，与你共同演绎一场真实而充满悬念的狼人杀对局。</p>
              </div>
              <div className="wisdom-note">
                <div className="wisdom-icon"><StarFilled /></div>
                <div>
                  <strong>白天寻找真相，黑夜决定命运。</strong>
                  <span>每一句发言，都会改变村庄的走向。</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lobby-card-stack">
            <article className="lobby-card join-card">
              <div className="card-head">
                <span className="card-icon"><LoginOutlined /></span>
                <span className="card-kicker">加入大厅</span>
              </div>
              <h3>进入村庄</h3>
              <p>输入房间号，加入一个正在进行的故事。</p>
              <div className="action-row">
                <input
                  value={roomKey || ''}
                  onChange={e => setRoomKey(e.target.value)}
                  onKeyDown={e => {
                    if(e.key === 'Enter') joinRoom()
                  }}
                  placeholder="输入房间号..."
                />
                <button className="primary-button red-button" type="button" onClick={joinRoom} disabled={actionLoading === 'join'}>
                  进入
                </button>
              </div>
            </article>

            <article className="lobby-card create-card">
              <div className="card-head">
                <span className="card-icon"><BookOutlined /></span>
                <span className="card-kicker"><StarFilled /> 房主</span>
              </div>
              <h3>开启新章节</h3>
              <p>召集神灵，策划你自己的多智能体游戏。</p>
              <div className="action-row single">
                <input
                  value={newRoom || ''}
                  onChange={e => setNewRoom(e.target.value)}
                  onKeyDown={e => {
                    if(e.key === 'Enter') createRoom()
                  }}
                  placeholder="输入房间名称..."
                />
              </div>
              <button className="primary-button green-button full-button" type="button" onClick={createRoom} disabled={actionLoading === 'create'}>
                <PlusCircleFilled />
                创建游戏房间
              </button>
            </article>

            <article className="lobby-card observe-card">
              <div className="card-head">
                <span className="card-icon"><EyeOutlined /></span>
                <span className="card-kicker">观战</span>
              </div>
              <h3>旁听迷雾</h3>
              <p>输入房间号，以旁观者身份翻阅正在发生的议事。</p>
              <div className="action-row">
                <input
                  value={observeKey || ''}
                  onChange={e => setObserveKey(e.target.value)}
                  onKeyDown={e => {
                    if(e.key === 'Enter') obGame()
                  }}
                  placeholder="输入观战房间号..."
                />
                <button className="primary-button olive-button" type="button" onClick={obGame} disabled={actionLoading === 'observe'}>
                  进入观战
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="history-section">
          <div className="history-heading">
            <h2>日志回顾</h2>
            <span />
            <em>{historyTotal ? `共 ${historyTotal} 局` : ''}</em>
          </div>
          <div className="history-scroll">
            {historyLoading ? <div className="history-empty">正在翻阅日志...</div> : null}
            {!historyLoading && historyList.length < 1 ? <div className="history-empty">暂无历史复盘记录</div> : null}
            {!historyLoading && historyList.map((item, index) => {
              const tone = getReplayTone(item)
              const code = `#${item.roomId || item.gameId || '-'}`
              return (
                <button
                  className={`history-card rotate-${index % 4}`}
                  disabled={!item.hasReplay}
                  key={`${item.gameId}-${item.roomId || index}`}
                  type="button"
                  onClick={() => openReplayDetail(item)}
                >
                  <div className="history-meta">
                    <span>{formatReplayDate(item.endTime || item.replayTimestamp || item.startTime)}</span>
                    <b>{code}</b>
                  </div>
                  <p>{getReplaySummary(item)}</p>
                  <div className="history-role-line">
                    <span>{(item.player && item.player.name) || item.username || user.name || user.username}</span>
                    <b>{item.player && item.player.roleName ? item.player.roleName : '身份未知'}</b>
                  </div>
                  <div className="history-result">
                    <div className="history-dots">
                      {getReplayColors(item).map((color, colorIndex) => <span key={`${item.gameId}-${color}-${colorIndex}`} style={{backgroundColor: color}} />)}
                    </div>
                    <strong className={`result-${tone}`}>{item.isWin === true ? '胜利' : item.isWin === false ? '失败' : (item.winnerLabel || '未知')}</strong>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <strong>雾中窥影</strong>
        <div>
          <button type="button">隐私政策</button>
          <button type="button">服务条款</button>
          <button type="button">联系我们</button>
        </div>
        <span>© 1244 村落议会。版权所有。</span>
      </footer>

      <Modal
        title="新增玩家账号"
        centered
        className="modal-view-wrap"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={createUserModal}
        onOk={createUser}
        okText="保存"
        cancelText="取消"
        onCancel={() => {
          setCreateUserModal(false)
        }}
      >
        <div>
          <div className="item-cell FBH FBAC mar-b10">
            <div className="item-title">账号：</div>
            <Input
              className="item-cell-content"
              placeholder="请输入需要创建的账号名字"
              value={newPlayer.username}
              onChange={e =>{
                setNewPlayer({...newPlayer, username: e.target.value})
              }}
            />
          </div>
          <div className="item-cell FBH FBAC mar-b10">
            <div className="item-title">游戏昵称：</div>
            <Input
              className="item-cell-content"
              placeholder="请输入游戏昵称"
              value={newPlayer.name}
              onChange={e =>{
                setNewPlayer({...newPlayer, name: e.target.value})
              }}
            />
          </div>
          <div className="item-cell FBH FBAC mar-b10">
            <div className="item-title">密码：</div>
            <Input
              className="item-cell-content"
              placeholder="请输入账号密码"
              value={newPlayer.password}
              onChange={e =>{
                setNewPlayer({...newPlayer, password: e.target.value})
              }}
            />
          </div>
          <div className="item-cell FBH FBAC">
            <div className="item-title">玩家类型：</div>
            <Radio.Group
              className="item-cell-content"
              options={playerType}
              onChange={(e)=>{
                setNewPlayer({...newPlayer, role: e.target.value})
              }}
              value={newPlayer.role}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="复盘详情"
        centered
        width={760}
        className="modal-view-wrap welcome-replay-modal"
        maskClosable={false}
        visible={replayModal}
        footer={[
          <button
            className="primary-button red-button replay-close-button"
            key="close"
            type="button"
            onClick={() => setReplayModal(false)}
          >
            关闭
          </button>
        ]}
        onCancel={() => setReplayModal(false)}
      >
        {replayLoading ? (
          <div className="replay-loading">正在读取复盘详情...</div>
        ) : replayDetail ? (
          <div className="replay-detail">
            <div className="replay-detail-meta">
              <span>{`房间 #${replayDetail.roomId || '-'}`}</span>
              <span>{`游戏 #${replayDetail.gameId || '-'}`}</span>
              <span>{`胜利阵营：${replayDetail.winnerLabel || '未知'}`}</span>
            </div>
            {Array.isArray(replayDetail.players) && replayDetail.players.length > 0 ? (
              <div className="replay-player-list">
                {replayDetail.players.map((player, index) => (
                  <span key={`${player.username || index}-${player.position || index}`}>
                    {`${player.position || '-'}号 ${player.name || player.username || '玩家'}${player.roleName ? ` / ${player.roleName}` : ''}`}
                  </span>
                ))}
              </div>
            ) : null}
            <pre className="replay-text">
              {(replayDetail.analysis && replayDetail.analysis.text) ||
                (replayDetail.analysis && replayDetail.analysis.json ? JSON.stringify(replayDetail.analysis.json, null, 2) : '') ||
                (replayDetail.gameRecord ? JSON.stringify(replayDetail.gameRecord, null, 2) : '') ||
                '本局复盘暂时没有文本内容。'}
            </pre>
          </div>
        ) : (
          <div className="replay-loading">暂无复盘详情</div>
        )}
      </Modal>

    </div>
  )
}
export default withRouter(inject('appStore')(observer(Index)))
