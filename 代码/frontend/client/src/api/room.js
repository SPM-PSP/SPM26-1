import fetch from '@common/fetch'
const urlPrefix = '/api/'

const withRoomIdAlias = (params = {}) => ({
  ...params,
  roomId: params.roomId || params.id,
  id: params.id || params.roomId,
})

const withUserIdAlias = (params = {}) => ({
  ...params,
  userId: params.userId || params.id,
  id: params.id || params.userId,
})

export default {

  createRoom (params) {
    return fetch({
      url: urlPrefix + 'room/create/auth',
      method: 'get',
      params,
    })
  },

  getRoomInfo (params) {
    return fetch({
      url: urlPrefix + 'room/info/auth',
      method: 'get',
      params,
    })
  },

  joinRoom (params) {
    return fetch({
      url: urlPrefix + 'room/join/auth',
      method: 'get',
      params,
    })
  },

  seatIn (params) {
    return fetch({
      url: urlPrefix + 'room/seat/auth',
      method: 'get',
      params: withRoomIdAlias(params),
    })
  },

  kickPlayer (params) {
    return fetch({
      url: urlPrefix + 'room/kick/auth',
      method: 'get',
      params: withRoomIdAlias(params),
    })
  },

  quitRoom (params) {
    return fetch({
      url: urlPrefix + 'room/quit/auth',
      method: 'get',
      params,
    })
  },

  modifyNameInRoom (params) {
    return fetch({
      url: urlPrefix + 'room/modifyName/auth',
      method: 'get',
      params: withUserIdAlias(params),
    })
  }

}
