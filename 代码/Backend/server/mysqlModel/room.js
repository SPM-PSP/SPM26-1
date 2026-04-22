const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_room',
    Base.withBase(DataTypes, {
      name: { type: DataTypes.STRING(64), defaultValue: '狼人杀房间' },
      status: { type: DataTypes.INTEGER, defaultValue: 0 },
      gameId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      password: { type: DataTypes.STRING(16), allowNull: false },
      owner: { type: DataTypes.STRING(64), allowNull: false },
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
      count: { type: DataTypes.INTEGER, defaultValue: 12 },
      wait: { type: DataTypes.JSON, defaultValue: [] },
      ob: { type: DataTypes.JSON, defaultValue: [] },
      remark: { type: DataTypes.STRING(255) },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_room',
    }
  );
};
