const { Op } = require('sequelize');

module.exports = (app) => ({
  async getRoute() {
    const { route } = app.$model;
    return await route.findAll({
      where: { status: 1 },
      attributes: ['path', 'roles', 'key', 'backUrl', 'exact', 'name'],
    });
  },

  async getList(page = 1, pageSize = 10, params) {
    const { route } = app.$model;
    let { searchKey, status } = params;

    const where = {};
    const parsedStatus = status !== undefined && status !== null ? status - 0 : 2;

    if (searchKey && searchKey !== '') {
      const likeCond = { [Op.like]: `%${searchKey}%` };
      const searchOr = [{ name: likeCond }, { key: likeCond }, { path: likeCond }];
      if (parsedStatus !== 2) {
        where[Op.and] = [{ [Op.or]: searchOr }, { status: parsedStatus }];
      } else {
        where[Op.or] = searchOr;
      }
    } else if (parsedStatus !== 2) {
      where.status = parsedStatus;
    }

    const total = await route.count({ where });
    const list = await route.findAll({
      where,
      offset: pageSize * (page < 1 ? 0 : page - 1),
      limit: pageSize - 0,
      order: [['_id', 'DESC']],
    });

    return { list, total };
  },
});
