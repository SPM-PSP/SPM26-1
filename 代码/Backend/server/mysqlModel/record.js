const Base = require('./baseModel');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'lcoco_record',
    Base.withBase(DataTypes, {
      roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      gameId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      content: { type: DataTypes.JSON, allowNull: false },
      view: { type: DataTypes.JSON, defaultValue: [] },
      isCommon: { type: DataTypes.INTEGER, defaultValue: 0 },
      stage: { type: DataTypes.FLOAT, defaultValue: 0 },
      day: { type: DataTypes.INTEGER, defaultValue: 1 },
      isTitle: { type: DataTypes.INTEGER, defaultValue: 0 },
      remark: { type: DataTypes.STRING(255) },
    }),
    {
      ...Base.baseOptions,
      tableName: 'lcoco_record',
    }
  );
};
