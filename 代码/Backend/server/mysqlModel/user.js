const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_user',
    Base.withBase(DataTypes, {
      username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      name: { type: DataTypes.STRING(64), defaultValue: '' },
      roles: { type: DataTypes.JSON, defaultValue: [] },
      defaultRoleName: { type: DataTypes.STRING(32) },
      defaultRole: { type: DataTypes.STRING(32) },
      remark: { type: DataTypes.STRING(255) },
      status: { type: DataTypes.INTEGER, defaultValue: 1 },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_user',
    }
  );
};
