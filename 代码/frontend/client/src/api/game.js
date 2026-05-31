import fetch from '@common/fetch'
const urlPrefix = '/api/'
export default {

  startGame (param) {
    return fetch({
      url: urlPrefix + 'game/start/auth',
      method: 'post',
      data: param,
      timeout: 70000,
    })
  },

  getGameInfo (params) {
    return fetch({
      url: urlPrefix + 'game/info/auth',
      method: 'get',
      params,
    })
  },

  nextStage (params) {
    return fetch({
      url: urlPrefix + 'game/nextStage/auth',
      method: 'get',
      params,
    })
  },

  userNextStage (params) {
    return fetch({
      url: urlPrefix + 'game/userNextStage/auth',
      method: 'get',
      params,
    })
  },

  gameRecord (params) {
    return fetch({
      url: urlPrefix + 'game/record/auth',
      method: 'get',
      params,
    })
  },

  checkPlayer (params) {
    return fetch({
      url: urlPrefix + 'game/checkPlayer/auth',
      method: 'get',
      params,
    })
  },

  assaultPlayer (params) {
    return fetch({
      url: urlPrefix + 'game/assaultPlayer/auth',
      method: 'get',
      params,
    })
  },

  wolfSuggestions (params) {
    return fetch({
      url: urlPrefix + 'game/wolfSuggestions/auth',
      method: 'get',
      params,
      overHandle: true,
    })
  },

  antidotePlayer (params) {
    return fetch({
      url: urlPrefix + 'game/antidotePlayer/auth',
      method: 'get',
      params,
    })
  },

  votePlayer (params) {
    return fetch({
      url: urlPrefix + 'game/votePlayer/auth',
      method: 'get',
      params,
    })
  },

  poisonPlayer (params) {
    return fetch({
      url: urlPrefix + 'game/poisonPlayer/auth',
      method: 'get',
      params,
    })
  },

  shootPlayer (params) {
    return fetch({
      url: urlPrefix + 'game/shootPlayer/auth',
      method: 'get',
      params,
    })
  },

  boomPlayer (params) {
    return fetch({
      url: urlPrefix + 'game/boomPlayer/auth',
      method: 'get',
      params,
    })
  },

  gameResult (params) {
    return fetch({
      url: urlPrefix + 'game/result/auth',
      method: 'get',
      params: {
        ...params,
        id: params.id || params.gameId,
      },
    })
  },

  gameDestroy (params) {
    return fetch({
      url: urlPrefix + 'game/destroy/auth',
      method: 'get',
      params,
    })
  },

  gameReplay (params) {
    return fetch({
      url: urlPrefix + 'game/replay/auth',
      method: 'post',
      data: params,
    })
  },

  replayHealth (params) {
    return fetch({
      url: urlPrefix + 'game/replay/health/auth',
      method: 'get',
      params,
    })
  },

  replayFile (params) {
    return fetch({
      url: urlPrefix + 'game/replay/file',
      method: 'get',
      params,
      overHandle: true,
    })
  },

  playerReplayHistory (params) {
    return fetch({
      url: urlPrefix + 'game/replay/player/history/auth',
      method: 'get',
      params,
    })
  },

  replayDetail (params) {
    return fetch({
      url: urlPrefix + 'game/replay/detail/auth',
      method: 'get',
      params,
    })
  },

  saveLastWords (params) {
    return fetch({
      url: urlPrefix + 'game/saveLastWords/auth',
      method: 'post',
      data: params,
    })
  },

  debugRoles (params) {
    return fetch({
      url: urlPrefix + 'game/debug/roles',
      method: 'get',
      params,
      headers: {
        'X-Debug-Mode': 'enabled',
      },
    })
  },

  gameAgain (params) {
    return fetch({
      url: urlPrefix + 'game/again/auth',
      method: 'get',
      params,
    })
  },

  obGame (params) {
    return fetch({
      url: urlPrefix + 'game/ob/auth',
      method: 'get',
      params,
    })
  },
}
