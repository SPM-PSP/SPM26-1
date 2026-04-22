const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_player',
    Base.withBase(DataTypes, {
      roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      gameId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      userId: { type: DataTypes.BIGINT.UNSIGNED },
      username: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(64) },
      role: { type: DataTypes.STRING(32), allowNull: false },
      roleName: { type: DataTypes.STRING(32) },
      camp: { type: DataTypes.INTEGER, defaultValue: 0 },
      campName: { type: DataTypes.STRING(32) },
      status: { type: DataTypes.INTEGER, defaultValue: 1 },
      outReason: { type: DataTypes.STRING(32) },
      position: { type: DataTypes.INTEGER, allowNull: false },
      skill: { type: DataTypes.JSON, defaultValue: [] },
      remark: { type: DataTypes.STRING(255) },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_player',
    }
  );
};
