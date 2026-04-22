module.exports = {
  baseColumns(DataTypes) {
    return {
      _id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      createTime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      modifyTime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      createId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      modifyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      isDelete: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    };
  },
  baseOptions: {
    timestamps: true,
    createdAt: 'createTime',
    updatedAt: 'modifyTime',
    freezeTableName: true,
  },
  withBase(DataTypes, fields) {
    return {
      ...this.baseColumns(DataTypes),
      ...fields,
    };
  },
};
