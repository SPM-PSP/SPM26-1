import fetch from '@common/fetch'

const urlPrefix = '/api/'

export default {
  stt (audio, params = {}) {
    const data = new FormData()
    data.append('audio', audio)
    Object.keys(params).forEach(key => {
      data.append(key, params[key])
    })
    return fetch({
      url: urlPrefix + 'voice/stt/auth',
      method: 'post',
      data,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  tts (text, params = {}) {
    return fetch({
      url: urlPrefix + 'voice/tts/auth',
      method: 'post',
      data: {
        text,
        ...params,
      },
      responseType: 'blob',
      overHandle: true,
    })
  },

  speech (audio, params = {}) {
    const data = new FormData()
    data.append('audio', audio)
    Object.keys(params).forEach(key => {
      data.append(key, params[key])
    })
    return fetch({
      url: urlPrefix + 'voice/speech/auth',
      method: 'post',
      data,
      timeout: 90000,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  speechText (params = {}) {
    return fetch({
      url: urlPrefix + 'voice/speech/auth',
      method: 'post',
      data: params,
      timeout: 90000,
      overHandle: true,
    })
  },
}
