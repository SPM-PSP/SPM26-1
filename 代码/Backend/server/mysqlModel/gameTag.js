const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_game_tag',
    Base.withBase(DataTypes, {
      roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      gameId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      day: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      stage: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      target: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(64) },
      position: { type: DataTypes.INTEGER },
      dayStatus: { type: DataTypes.INTEGER, allowNull: false },
      desc: { type: DataTypes.STRING(32), allowNull: false, field: 'tagDesc' },
      mode: { type: DataTypes.INTEGER, allowNull: false },
      value: { type: DataTypes.STRING(255) },
      value2: { type: DataTypes.JSON, defaultValue: [] },
      value3: { type: DataTypes.JSON, defaultValue: {} },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_game_tag',
    }
  );
};
