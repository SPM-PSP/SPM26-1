module.exports = (app) => ({
  async getUsersByUsername(username) {
    const { $model } = app;
    const { user } = $model;
    if (!username || username.length === 0) {
      return null;
    }
    return await user.findOne({
      where: { username, status: 1 },
      attributes: { exclude: ['password'] },
    });
  },

  async getUsersPasswordByUsername(username) {
    const { $model } = app;
    const { user } = $model;
    if (!username || username.length === 0) {
      return null;
    }
    return await user.findOne({
      where: { username },
      attributes: ['password'],
    });
  },

  async getUserInfoById(id) {
    const { $model } = app;
    const { user } = $model;
    return await user.findByPk(id);
  },

  async createUser(username, password) {
    const { user } = app.$model;
    await user.create({
      username,
      password,
      name: '默认姓名',
      roles: ['player'],
      defaultRole: 'player',
      defaultRoleName: '玩家',
      status: 1,
    });

    return await user.findOne({
      where: { username },
      attributes: { exclude: ['password'] },
    });
  },
});
