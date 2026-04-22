const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_game',
    Base.withBase(DataTypes, {
      roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      owner: { type: DataTypes.STRING(64), allowNull: false },
      status: { type: DataTypes.INTEGER, defaultValue: 1 },
      stage: { type: DataTypes.FLOAT, defaultValue: 0 },
      day: { type: DataTypes.INTEGER, defaultValue: 1 },
      v1: { type: DataTypes.STRING(64) },
      v2: { type: DataTypes.STRING(64) },
      v3: { type: DataTypes.STRING(64) },
      v4: { type: DataTypes.STRING(64) },
      v5: { type: DataTypes.STRING(64) },
      v6: { type: DataTypes.STRING(64) },
      v7: { type: DataTypes.STRING(64) },
      v8: { type: DataTypes.STRING(64) },
      v9: { type: DataTypes.STRING(64) },
      v10: { type: DataTypes.STRING(64) },
      v11: { type: DataTypes.STRING(64) },
      v12: { type: DataTypes.STRING(64) },
      winner: { type: DataTypes.INTEGER, defaultValue: -1 },
      mode: { type: DataTypes.STRING(32), defaultValue: 'standard_9' },
      playerCount: { type: DataTypes.INTEGER, defaultValue: 9 },
      witchSaveSelf: { type: DataTypes.INTEGER, defaultValue: 1 },
      winCondition: { type: DataTypes.INTEGER, defaultValue: 1 },
      flatTicket: { type: DataTypes.INTEGER, defaultValue: 1 },
      p1: { type: DataTypes.INTEGER, defaultValue: 30 },
      p2: { type: DataTypes.INTEGER, defaultValue: 45 },
      p3: { type: DataTypes.INTEGER, defaultValue: 30 },
      remark: { type: DataTypes.STRING(255) },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_game',
    }
  );
};
