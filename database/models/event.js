// KrayStakes Discord Bot - Event Model
const { DataTypes } = require('sequelize');
const { sequelize } = require('../dbInit');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('boxing', 'racing', 'paintball', 'custom'),
    allowNull: false,
    defaultValue: 'custom'
  },
  status: {
    type: DataTypes.ENUM('pending', 'open', 'locked', 'paused', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  scheduledTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Discord user ID of the creator'
  },
  announcementMessageId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Discord message ID of the announcement'
  },
  totalBetsAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total amount of bets placed on this event'
  },
  totalBetsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total number of bets placed on this event'
  },
  choices: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]',
    get() {
      const rawValue = this.getDataValue('choices');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('choices', JSON.stringify(value));
    },
    comment: 'JSON array of choices for the event'
  },
  winners: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('winners');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('winners', JSON.stringify(value));
    },
    comment: 'JSON array of winner choices'
  },
  customResults: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Custom results text for the event'
  },
  minBet: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
    comment: 'Minimum bet amount'
  },
  maxBet: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1000,
    comment: 'Maximum bet amount'
  },
  limitPerUser: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2,
    comment: 'Maximum number of bets per user'
  },
  feePercent: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    comment: 'Fee percentage taken from winnings'
  },
  remindersSent: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('remindersSent');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('remindersSent', JSON.stringify(value));
    },
    comment: 'JSON array of reminder times that have been sent'
  }
}, {
  tableName: 'events',
  indexes: [
    {
      name: 'idx_events_status',
      fields: ['status']
    },
    {
      name: 'idx_events_scheduledTime',
      fields: ['scheduledTime']
    },
    {
      name: 'idx_events_type',
      fields: ['type']
    }
  ]
});

module.exports = Event;