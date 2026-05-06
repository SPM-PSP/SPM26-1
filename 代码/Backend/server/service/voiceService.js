const axios = require('axios')
const fs = require('fs')
const { randomUUID } = require('crypto')

module.exports = app => {
  const getConfig = () => {
    const config = app.$config.voiceService || {}
    return {
      apiKey: process.env.VOLCENGINE_API_KEY || config.apiKey || '',
      uid: process.env.VOLCENGINE_UID || config.uid || 'werewolf-voice-user',
      sttUrl: process.env.VOLCENGINE_STT_URL || config.sttUrl || 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash',
      sttResourceId: process.env.VOLCENGINE_STT_RESOURCE_ID || config.sttResourceId || 'volc.bigasr.auc_turbo',
      ttsUrl: process.env.VOLCENGINE_TTS_URL || config.ttsUrl || 'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
      ttsResourceId: process.env.VOLCENGINE_TTS_RESOURCE_ID || config.ttsResourceId || 'seed-tts-2.0',
      ttsSpeaker: process.env.VOLCENGINE_TTS_SPEAKER || config.ttsSpeaker || 'zh_female_vv_uranus_bigtts',
      timeout: Number(process.env.VOICE_SERVICE_TIMEOUT || config.timeout || 90000),
    }
  }

  const assertApiKey = (config) => {
    if(!config.apiKey){
      throw new Error('语音服务未配置 VOLCENGINE_API_KEY')
    }
  }

  const readFileBuffer = (file) => {
    if(!file){
      return null
    }
    const filepath = file.filepath || file.path
    if(!filepath){
      return null
    }
    return fs.readFileSync(filepath)
  }

  const normalizeUploadFile = (files) => {
    if(!files){
      return null
    }
    const file = files.audio || files.file || files.voice
    return Array.isArray(file) ? file[0] : file
  }

  const getAudioBuffer = (ctx) => {
    const body = ctx.request.body || {}
    if(body.audioBase64){
      const raw = String(body.audioBase64).replace(/^data:audio\/[^;]+;base64,/, '')
      return Buffer.from(raw, 'base64')
    }
    const file = normalizeUploadFile(ctx.request.files)
    return readFileBuffer(file)
  }

  const parseTtsStream = async (stream) => {
    const chunks = []
    let pending = ''

    for await (const chunk of stream) {
      pending += chunk.toString('utf8')
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() || ''

      for(let i = 0; i < lines.length; i++){
        const line = lines[i].trim()
        if(!line){
          continue
        }
        let result
        try {
          result = JSON.parse(line)
        } catch (e) {
          continue
        }
        const code = result.code
        if(code === 20000000){
          return Buffer.concat(chunks)
        }
        if(code !== 0 && code !== 20000000){
          throw new Error('TTS接口报错：' + (result.message || code))
        }
        if(result.data){
          chunks.push(Buffer.from(result.data, 'base64'))
        }
      }
    }

    if(pending.trim()){
      try {
        const result = JSON.parse(pending.trim())
        if(result.data){
          chunks.push(Buffer.from(result.data, 'base64'))
        }
      } catch (e) {
        // Ignore incomplete trailing data from streaming response.
      }
    }
    return Buffer.concat(chunks)
  }

  return ({
    getAudioBuffer,

    async sttFromBuffer(audioBuffer) {
      const config = getConfig()
      assertApiKey(config)
      if(!audioBuffer || audioBuffer.length < 1){
        throw new Error('缺少音频文件')
      }

      const res = await axios({
        method: 'post',
        url: config.sttUrl,
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': config.apiKey,
          'X-Api-Resource-Id': config.sttResourceId,
          'X-Api-Request-Id': randomUUID(),
          'X-Api-Sequence': '-1',
        },
        data: {
          user: { uid: config.uid },
          audio: { data: audioBuffer.toString('base64') },
          request: {
            model_name: 'bigmodel',
            show_utterances: true,
            enable_itn: true,
            enable_punc: true,
          },
        },
      })

      const status = res.headers['x-api-status-code'] || ''
      const message = res.headers['x-api-message'] || ''
      if(status && status !== '20000000'){
        throw new Error('STT接口报错：' + status + (message ? ' ' + message : ''))
      }

      const result = res.data && res.data.result ? res.data.result : {}
      const text = String(result.text || '').trim()
      if(!text){
        throw new Error('STT未识别到有效文本')
      }
      return {
        text,
        utterances: result.utterances || [],
      }
    },

    async ttsToBuffer(text, options = {}) {
      const config = getConfig()
      assertApiKey(config)
      const content = String(text || '').trim()
      if(!content){
        throw new Error('text不能为空')
      }

      const res = await axios({
        method: 'post',
        url: config.ttsUrl,
        timeout: config.timeout,
        responseType: 'stream',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': config.apiKey,
          'X-Api-Resource-Id': config.ttsResourceId,
          'X-Api-Request-Id': randomUUID(),
        },
        data: {
          user: { uid: config.uid },
          req_params: {
            text: content,
            speaker: options.speaker || config.ttsSpeaker,
            audio_params: {
              format: 'mp3',
              sample_rate: Number(options.sampleRate || 24000),
              speech_rate: Number(options.speechRate || 0),
            },
          },
        },
      })

      const audio = await parseTtsStream(res.data)
      if(!audio || audio.length < 1){
        throw new Error('TTS未返回音频数据')
      }
      return audio
    },
  })
}
