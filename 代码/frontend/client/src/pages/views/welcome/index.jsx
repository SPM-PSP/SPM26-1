import React, {useState} from "react";
import "./index.styl";
import {inject, observer} from "mobx-react";
import {withRouter} from "react-router-dom";
import apiUser from '@api/user'
import apiRoom from '@api/room'
import apiGame from '@api/game'
import {Modal, Input, Radio, message} from "antd";
import {
  AudioOutlined,
  BookOutlined,
  CompassOutlined,
  EyeOutlined,
  LoginOutlined,
  LogoutOutlined,
  PlusCircleFilled,
  SettingOutlined,
  StarFilled,
  TeamOutlined,
} from '@ant-design/icons'
import helper from '@helper'
import {isMockEnabled} from '@common/mock'

const ambientImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDTprKn8FUcolWLiiCjptxHgZ_mEeN6w98ajveTjSwhHkCavgVAKIeG0i_Sin4W7fSP59-4Ux8MVwY5f485UBfNN42bif9FZhkEr9C3I8ox2bw7gNnIr5LExnyHkjMcBw5I0EQWY_y7ycg2sIftmauVb__nFRaH2KGC8bF8_us5gmrNzkY8miFdLL5H-iQnzGWkIZuxAt7lWkzwrFOG1HprCGQekjWD49xDhCNqUVKrSI7aJykTa8A00WAukSo_rRs3NTCrZ2hUL3o'
const storyImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAYOI1VfnpoH1Am3vC02dVZ8Kg8cgVdPHEqXtH2zisqyO-lnD41pAYJjtvpSMR_uTwb7IjRr4oxFTUYDJw4MBuNqIkTVQn25BmEQXZcTnmnYNRKKV8JJ8_p1Lr89_AWnk_2MMy_SEfTuO0zvkDp8ndtwtaQfkH757wKWdy8IBR4dkLv2UPIcGmfA8Vo5sRyvoWQg5bIzgXnI1WoL_8atUwm2-1SelHapzwtjH87irKXol4RiTXHLHuY9ONZXXOOFEAKJpOeRNt8BjI'

const historyCards = [
  {
    time: 'May 14, Morning',
    code: '#2819',
    quote: '"The wolf was found near the mill, yet the Spirit of Vengeance demanded more..."',
    result: 'WOLVES WON',
    tone: 'danger',
    colors: ['#cbd5e1', '#fde68a', '#34d399'],
  },
  {
    time: 'May 12, Nightfall',
    code: '#2812',
    quote: '"Silence fell upon the square. The Ledger was closed with no more souls to count."',
    result: 'VILLAGE WON',
    tone: 'success',
    colors: ['#f87171', '#bfdbfe'],
  },
  {
    time: 'May 10, Mist',
    code: '#2798',
    quote: '"A strange alliance formed under the shadow of the great spruce."',
    result: 'DRAW',
    tone: 'neutral',
    colors: ['#c084fc', '#fed7aa', '#e5e7eb'],
  },
  {
    time: 'May 08, Hearth',
    code: '#2755',
    quote: '"The blacksmith\'s daughter spoke truth, but the Spirits were deaf that night."',
    result: 'WOLVES WON',
    tone: 'danger',
    colors: ['#facc15', '#fbcfe8'],
  },
]

const Index = (props) => {
  const {appStore, history} = props;
  const {user, logout} = appStore
  const mockOn = isMockEnabled()

  const [createUserModal, setCreateUserModal] = useState(false)
  const [newPlayer, setNewPlayer] = useState({})

  const [newRoom, setNewRoom] = useState(mockOn ? '月夜审判体验房' : '')
  const [roomKey, setRoomKey] = useState(mockOn ? 'MOCK' : '')
  const [observeKey, setObserveKey] = useState(mockOn ? 'MOCK' : '')
  const [actionLoading, setActionLoading] = useState('')

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

  return (
    <div className="welcome-container">
      <div className="welcome-bg" aria-hidden="true">
        <img src={ambientImage} alt="" />
      </div>

      <aside className="welcome-rail">
        <div className="welcome-avatar">月</div>
        <button className="rail-item rail-active" type="button" title="广场"><CompassOutlined /></button>
        <button className="rail-item" type="button" title="玩家"><TeamOutlined /></button>
        <button className="rail-item" type="button" title="行动"><BookOutlined /></button>
        <button className="rail-item" type="button" title="观战"><EyeOutlined /></button>
        <button className="rail-help" type="button" title="帮助">?</button>
      </aside>

      <header className="welcome-topbar">
        <div className="welcome-brand">村落日志</div>
        <nav>
          <button className="active" type="button">游戏规则</button>
          <button type="button">世界观</button>
        </nav>
        <div className="welcome-top-actions">
          <button type="button" aria-label="音量"><AudioOutlined /></button>
          <button type="button" aria-label="设置"><SettingOutlined /></button>
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
            <h1>村落日志</h1>
            <p>这里的每一句低语都会留下痕迹。</p>
          </div>
        </section>

        <section className="welcome-content-grid">
          <div className="storybook-card">
            <div className="storybook-copy">
              <span className="story-chip">简介</span>
              <h2>迷雾森林的守望者</h2>
              <p>在迷雾笼罩的森林中，古老的灵体正在注视着村庄。这些AI多智能体是你的向导、你的陪审员，有时也是你的噩运。</p>
              <div className="wisdom-note">
                <div className="wisdom-icon"><StarFilled /></div>
                <div>
                  <strong>集体智慧</strong>
                  <span>神灵会权衡在日志中说出的每一句话。</span>
                </div>
              </div>
            </div>
            <div className="storybook-art">
              <img src={storyImage} alt="magical wisps in forest" />
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
            <button type="button">查看档案 →</button>
          </div>
          <div className="history-scroll">
            {historyCards.map((item, index) => (
              <article className={`history-card rotate-${index}`} key={item.code}>
                <div className="history-meta">
                  <span>{item.time}</span>
                  <b>{item.code}</b>
                </div>
                <p>{item.quote}</p>
                <div className="history-result">
                  <div className="history-dots">
                    {item.colors.map(color => <span key={`${item.code}-${color}`} style={{backgroundColor: color}} />)}
                  </div>
                  <strong className={`result-${item.tone}`}>{item.result}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <strong>村落日志</strong>
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

    </div>
  )
}
export default withRouter(inject('appStore')(observer(Index)))
