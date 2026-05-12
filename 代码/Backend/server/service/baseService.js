const { Op } = require('sequelize');

const isPlainObject = (value) => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

const normalizeLikeValue = (value) => {
  if (value instanceof RegExp) {
    return { [Op.like]: `%${value.source}%` };
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const opMap = {
    $in: Op.in,
    $ne: Op.ne,
    $gt: Op.gt,
    $gte: Op.gte,
    $lt: Op.lt,
    $lte: Op.lte,
    $like: Op.like,
  };

  const keys = Object.keys(value);
  const out = {};
  keys.forEach((key) => {
    if (opMap[key]) {
      out[opMap[key]] = value[key];
    } else {
      out[key] = normalizeLikeValue(value[key]);
    }
  });
  return out;
};

const normalizeWhere = (params) => {
  if (!isPlainObject(params)) {
    return params || {};
  }

  const where = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (key === '$and' && Array.isArray(value)) {
      where[Op.and] = value.map((item) => normalizeWhere(item));
      return;
    }
    if (key === '$or' && Array.isArray(value)) {
      where[Op.or] = value.map((item) => normalizeWhere(item));
      return;
    }
    where[key] = normalizeLikeValue(value);
  });
  return where;
};

const buildAttributes = (projection = {}) => {
  if (!projection || Object.keys(projection).length < 1) {
    return {};
  }

  const include = [];
  const exclude = [];
  Object.keys(projection).forEach((key) => {
    if (projection[key] === 1) {
      include.push(key);
    }
    if (projection[key] === 0) {
      exclude.push(key);
    }
  });

  if (include.length > 0) {
    return { attributes: include };
  }

  if (exclude.length > 0) {
    return { attributes: { exclude } };
  }

  return {};
};

const buildOrder = (sort) => {
  if (!sort || !isPlainObject(sort)) {
    return [['_id', 'DESC']];
  }
  const entries = Object.entries(sort);
  if (entries.length < 1) {
    return [['_id', 'DESC']];
  }
  return entries.map(([field, direction]) => {
    const d = Number(direction) >= 0 ? 'ASC' : 'DESC';
    return [field, d];
  });
};

const buildQueryOptions = (projection, options, useDefaultSort = true) => {
  const attrs = buildAttributes(projection);

  if (options === false || options === 'false') {
    return {
      ...attrs,
    };
  }

  const queryOptions = {
    ...attrs,
  };

  if (options && options.sort) {
    queryOptions.order = buildOrder(options.sort);
  } else if (useDefaultSort) {
    queryOptions.order = [['_id', 'DESC']];
  }

  if (options && options.limit !== undefined && options.limit !== null) {
    queryOptions.limit = Number(options.limit);
  }
  if (options && options.skip !== undefined && options.skip !== null) {
    queryOptions.offset = Number(options.skip);
  }

  return queryOptions;
};

module.exports = (app) => ({
  async queryById(model, id) {
    const { $log4 } = app;
    const { errorLogger } = $log4;
    try {
      return await model.findByPk(id);
    } catch (e) {
      errorLogger.error('【baseService】—— queryById：' + e.toString());
      console.log(e);
      return false;
    }
  },

  async queryOne(model, params, projection = {}, options = {}) {
    const { $log4 } = app;
    const { errorLogger } = $log4;
    try {
      return await model.findOne({
        where: normalizeWhere(params),
        ...buildQueryOptions(projection, options, false),
      });
    } catch (e) {
      errorLogger.error('【baseService】—— findOne：' + e.toString());
      console.log(e);
      return false;
    }
  },

  async query(model, params, projection, opt) {
    const { $log4 } = app;
    const { errorLogger } = $log4;
    try {
      return await model.findAll({
        where: normalizeWhere(params),
        ...buildQueryOptions(projection, opt, true),
      });
    } catch (e) {
      errorLogger.error('【baseService】—— query：' + e.toString());
      console.log(e);
      return false;
    }
  },

  async save(model, content) {
    const { $log4 } = app;
    const { errorLogger } = $log4;

    try {
      const payload = {
        ...content,
      };
      if (!payload.createTime) {
        payload.createTime = new Date();
      }
      payload.modifyTime = new Date();
      return await model.create(payload);
    } catch (e) {
      errorLogger.error('【baseService】—— save：' + e.toString());
      console.log('save failed：' + e);
      return false;
    }
  },

  async count(model, params) {
    const { $log4 } = app;
    const { errorLogger } = $log4;
    try {
      return await model.count({ where: normalizeWhere(params) });
    } catch (e) {
      errorLogger.error('【baseService】—— count：' + e.toString());
      console.log(e);
      return false;
    }
  },

  async updateById(model, id, data) {
    const { $log4 } = app;
    const { errorLogger } = $log4;
    try {
      const instance = await model.findByPk(id);
      if (!instance) {
        return false;
      }
      await instance.update({ ...data, modifyTime: new Date() });
      return instance;
    } catch (e) {
      errorLogger.error('【baseService】—— updateById：' + e.toString());
      console.log(e);
      return false;
    }
  },

  async batchUpdate(model, params, data) {
    const { $log4 } = app;
    const { errorLogger } = $log4;
    try {
      return await model.update(
        { ...data, modifyTime: new Date() },
        { where: normalizeWhere(params) }
      );
    } catch (e) {
      errorLogger.error('【baseService】—— batchUpdate：' + e.toString());
      console.log(e);
      return false;
    }
  },

  async updateOne(model, params, content) {
    const { $log4 } = app;
    const { errorLogger } = $log4;
    try {
      const instance = await model.findOne({ where: normalizeWhere(params) });
      if (!instance) {
        return false;
      }
      await instance.update({ ...content, modifyTime: new Date() });
      return instance;
    } catch (e) {
      errorLogger.error('【baseService】—— updateOne：' + e.toString());
      console.log(e);
      return false;
    }
  },

  async deleteById(model, id) {
    const { $log4 } = app;
    const { errorLogger } = $log4;
    if (!model) {
      return false;
    }
    try {
      await model.destroy({ where: { _id: id } });
      return true;
    } catch (e) {
      errorLogger.error('【baseService】 delete：' + e);
      console.log(e);
      return false;
    }
  },

  async delete(model, params) {
    const { $log4 } = app;
    const { errorLogger } = $log4;
    if (!model) {
      return false;
    }
    try {
      await model.destroy({ where: normalizeWhere(params) });
      return true;
    } catch (e) {
      errorLogger.error('【baseService】 delete：' + e);
      console.log(e);
      return false;
    }
  },

  async userInfo(ctx) {
    const { $service, $helper } = app;
    const token = ctx.header.authorization;
    let user;
    try {
      user = await $helper.decodeToken(token);
    } catch (e) {
      $helper.Result.fail(-1, e);
    }
    if (!user) {
      $helper.Result.fail(-1, '用户信息不存在');
    }
    const userId = user._id || user.id;
    return await $service.userService.getUserInfoById(userId);
  },
});
