// Mock for vue — only ref is needed by reportAdapter.js
module.exports = {
  ref: (initialValue) => ({ value: initialValue }),
}
