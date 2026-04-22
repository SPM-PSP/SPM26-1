const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_route',
    Base.withBase(DataTypes, {
      key: { type: DataTypes.STRING(64), defaultValue: '', field: 'routeKey' },
      path: { type: DataTypes.STRING(128), unique: true, allowNull: false },
      name: { type: DataTypes.STRING(64), defaultValue: '管理后台' },
      roles: { type: DataTypes.JSON, defaultValue: [] },
      exact: { type: DataTypes.BOOLEAN, defaultValue: true },
      backUrl: { type: DataTypes.STRING(128), defaultValue: '/403' },
      status: { type: DataTypes.INTEGER, defaultValue: 1 },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_route',
    }
  );
};
