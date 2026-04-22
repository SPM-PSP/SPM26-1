module.exports = app => ({
  /**
   * Check whether a user is already seated in a room.
   */
  async findInSeatPlayer (roomId, username = '') {
    const { $service, $helper, $model, $constants } = app;
    const { room } = $model;
    if (!roomId) {
      return $helper.wrapResult(false, 'roomId is required', -1);
    }
    const roomInstance = await $service.baseService.queryById(room, roomId);
    if (!roomInstance) {
      return $helper.wrapResult(false, 'room does not exist', -1);
    }
    const maxSeatCount = $constants.maxSeatCount || 12;
    for (let i = 1; i <= maxSeatCount; i++) {
      if (roomInstance['v' + i] === username) {
        return $helper.wrapResult(true, 'ok');
      }
    }
    return $helper.wrapResult(false, 'player not seated in this room', -1);
  },

  /**
   * Get room seat info.
   */
  async getRoomSeatPlayer (roomId, showPlayerInfo = false) {
    const { $service, $helper, $model, $constants } = app;
    const { user, room } = $model;
    if (!roomId) {
      return $helper.wrapResult(false, 'roomId is required', -1);
    }
    const roomInstance = await $service.baseService.queryById(room, roomId);
    if (!roomInstance) {
      return $helper.wrapResult(false, 'room does not exist', -1);
    }
    // 转换为纯 JSON 对象
    const roomData = roomInstance.toJSON ? roomInstance.toJSON() : roomInstance;
    // 使用房间的 count 字段，如果没有则默认为 9
    const count = Number(roomData.count) || 9;
    const list = [];
    for (let i = 0; i < count; i++) {
      const columnKey = 'v' + (i + 1);
      const username = roomData[columnKey];
      if (!username) {
        list.push({ player: null, position: i + 1, name: (i + 1) + '号' });
        continue;
      }
      const userInfo = await $service.baseService.queryOne(user, { username }, { username: 1, name: 1 });
      if (userInfo && showPlayerInfo !== false) {
        list.push({ player: userInfo, position: i + 1, name: (i + 1) + '号' });
      } else if (userInfo) {
        list.push({ player: userInfo, position: i + 1, name: (i + 1) + '号' });
      } else {
        list.push({ player: null, position: i + 1, name: (i + 1) + '号' });
      }
    }
    return $helper.wrapResult(true, list);
  },

  async isOb (roomId, username) {
    const { $service, $helper, $model } = app;
    const { room } = $model;
    if (!roomId || !username) {
      return $helper.wrapResult(true, 'N');
    }
    const roomInstance = await $service.baseService.queryById(room, roomId);
    if (!roomInstance) {
      return $helper.wrapResult(true, 'N');
    }
    const obList = roomInstance ? roomInstance.ob : [];
    if (obList.includes(username)) {
      return $helper.wrapResult(true, 'Y');
    }
    return $helper.wrapResult(true, 'N');
  },
});
