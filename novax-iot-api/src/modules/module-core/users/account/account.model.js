module.exports = (sequelize, DataTypes) => {
  const Account = sequelize.define(
    "Account",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      external_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        unique: true,
      },
      tenant_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "accounts",
      schema: "core",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [
        { unique: true, fields: ["tenant_id", "username"] },
        { unique: true, fields: ["tenant_id", "email"] },
      ],
    },
  );
  Account.associate = (models) => {
    Account.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    Account.belongsTo(models.User, {
      foreignKey: "user_id",
      as: "user",
    });
    Account.belongsToMany(models.Role, {
      through: models.AccountRole,
      foreignKey: "account_id",
      otherKey: "role_id",
      as: "roles",
    });
    Account.hasMany(models.ApiToken, { foreignKey: "account_id", as: "api_tokens" });
  };
  return Account;
};

