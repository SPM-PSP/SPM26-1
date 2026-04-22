const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_vision',
    Base.withBase(DataTypes, {
      roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      gameId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      from: { type: DataTypes.STRING(64), allowNull: false, field: 'sendFrom' },
      to: { type: DataTypes.STRING(64), allowNull: false, field: 'sendTo' },
      status: { type: DataTypes.INTEGER, defaultValue: 0 },
      remark: { type: DataTypes.STRING(255) },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_vision',
    }
  );
};
