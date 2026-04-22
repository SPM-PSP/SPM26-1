const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_action',
    Base.withBase(DataTypes, {
      roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      gameId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      day: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      stage: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      from: { type: DataTypes.STRING(64), allowNull: false, field: 'sendFrom' },
      to: { type: DataTypes.STRING(64), allowNull: false, field: 'sendTo' },
      action: { type: DataTypes.STRING(32), allowNull: false },
      remark: { type: DataTypes.STRING(255) },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_action',
    }
  );
};
