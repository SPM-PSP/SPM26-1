import apiGame from '@api/game'
import appConfig from '@config'
import helper from '@helper'

const DEFAULT_TIMEOUT_MS = 60000
const DEFAULT_INTERVAL_MS = 3000

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

const hasStructuredContent = (value) => {
  if (!value) {
    return false
  }
  if (isNonEmptyString(value)) {
    const text = value.trim()
    return text !== '{}' && text !== '[]'
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0
  }
  return false
}

const getReplayFiles = (detail = {}) => (
  detail.analysisFiles ||
  detail.analysis_files ||
  detail.replayFiles ||
  detail.replay_files ||
  {}
)

export const buildReplayPageUrl = (gameId) => {
  const replayUrl = appConfig.replayUrl || `http://${window.location.hostname}:5173`
  const url = new URL(replayUrl, window.location.href)
  url.searchParams.set('gameId', gameId)
  const token = helper.getToken()
  if (token) {
    url.searchParams.set('token', token)
  }
  return url.toString()
}

export const hasReplayContent = (detail = {}) => {
  const analysis = detail.analysis || {}
  const files = getReplayFiles(detail)
  const structuredReport = analysis.json || detail.analysisJson || detail.analysis_json
  const filePaths = [
    files.text,
    files.txt,
    files.path,
    files.report,
    files.json,
    files.jsonPath,
    files.json_path,
    detail.textPath,
    detail.text_path,
    detail.jsonPath,
    detail.json_path,
    detail.path,
  ]

  return (
    isNonEmptyString(analysis.text) ||
    hasStructuredContent(structuredReport) ||
    filePaths.some(isNonEmptyString)
  )
}

const isReplayPendingError = (error) => {
  const text = String(error || '').toLowerCase()
  return [
    '还没有生成',
    '未生成',
    '生成中',
    '暂无复盘',
    '未找到复盘',
    'pending',
    'processing',
    'not ready',
    'not found',
    '404',
  ].some(keyword => text.includes(keyword))
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const waitForReplayReport = async (gameId, options = {}) => {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  const intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS
  const startedAt = Date.now()
  let attempts = 0
  let lastError = null

  while (Date.now() - startedAt <= timeoutMs) {
    attempts += 1
    try {
      const detail = await apiGame.replayDetail({ gameId }, { overHandle: true })
      if (hasReplayContent(detail)) {
        return { ready: true, detail, attempts }
      }
      lastError = null
    } catch (error) {
      lastError = error
      if (!isReplayPendingError(error)) {
        return { ready: false, timedOut: false, error, attempts }
      }
    }

    const elapsedMs = Date.now() - startedAt
    if (elapsedMs >= timeoutMs) {
      break
    }
    if (typeof options.onWaiting === 'function') {
      options.onWaiting({
        attempts,
        elapsedMs,
        remainingMs: timeoutMs - elapsedMs,
        lastError,
      })
    }
    await sleep(Math.min(intervalMs, timeoutMs - elapsedMs))
  }

  return { ready: false, timedOut: true, error: lastError, attempts }
}
