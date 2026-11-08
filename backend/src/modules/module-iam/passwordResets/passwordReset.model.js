module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    "PasswordReset",
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      external_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
      },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      account_id: { type: DataTypes.INTEGER, allowNull: false },
      token_hash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      used_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      schema: "iam",
      tableName: "password_resets",
      underscored: true,
      timestamps: true,
    },
  );
