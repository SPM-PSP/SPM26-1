const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_role',
    Base.withBase(DataTypes, {
      key: { type: DataTypes.STRING(32), unique: true, allowNull: false, field: 'roleKey' },
      name: { type: DataTypes.STRING(32), defaultValue: '' },
      status: { type: DataTypes.INTEGER, defaultValue: 1 },
      remark: { type: DataTypes.STRING(255) },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_role',
    }
  );
};
