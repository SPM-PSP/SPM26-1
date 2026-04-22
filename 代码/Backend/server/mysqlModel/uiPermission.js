const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_ui_permission',
    Base.withBase(DataTypes, {
      key: { type: DataTypes.STRING(64), unique: true, allowNull: false, field: 'permKey' },
      name: { type: DataTypes.STRING(64), defaultValue: '' },
      roles: { type: DataTypes.JSON, defaultValue: [] },
      type: { type: DataTypes.STRING(32), defaultValue: 'button' },
      status: { type: DataTypes.INTEGER, defaultValue: 1 },
      remark: { type: DataTypes.STRING(255) },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_ui_permission',
    }
  );
};
