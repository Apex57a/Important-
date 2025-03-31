// KrayStakes Discord Bot - Log Model
const { DataTypes } = require('sequelize');
const { sequelize } = require('../dbInit');

const Log = sequelize.define('Log', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  level: {
    type: DataTypes.ENUM('info', 'warn', 'error', 'debug'),
    allowNull: false,
    defaultValue: 'info',
    comment: 'Log level'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Log message'
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'system',
    comment: 'Log type (e.g. system, event, bet, payout)'
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Discord user ID related to this log (if applicable)'
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('metadata');
      return rawValue ? JSON.parse(rawValue) : null;
    },
    set(value) {
      this.setDataValue('metadata', value ? JSON.stringify(value) : null);
    },
    comment: 'Additional metadata for the log'
  }
}, {
  tableName: 'logs',
  indexes: [
    {
      name: 'idx_logs_level',
      fields: ['level']
    },
    {
      name: 'idx_logs_type',
      fields: ['type']
    },
    {
      name: 'idx_logs_user',
      fields: ['userId']
    },
    {
      name: 'idx_logs_created',
      fields: ['createdAt']
    }
  ]
});

module.exports = Log;