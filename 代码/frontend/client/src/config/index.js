export default {
  websocket: {
    dev: process.env.REACT_APP_WS_DEV_HOST || window.location.hostname,
    prd: process.env.REACT_APP_WS_PRD_HOST || window.location.hostname,
  }
}
