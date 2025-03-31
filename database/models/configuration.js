// KrayStakes Discord Bot - Configuration Model
const { DataTypes } = require('sequelize');
const { sequelize } = require('../dbInit');

const Configuration = sequelize.define('Configuration', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    },
    comment: 'Configuration key name'
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Configuration value'
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'general',
    comment: 'Category of the configuration (e.g. general, betting, payout)'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Description of the configuration'
  },
  lastUpdatedBy: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Discord user ID of who last updated the configuration'
  }
}, {
  tableName: 'configurations',
  indexes: [
    {
      name: 'idx_configurations_key',
      fields: ['key'],
      unique: true
    },
    {
      name: 'idx_configurations_category',
      fields: ['category']
    }
  ]
});

module.exports = Configuration;