// KrayStakes Discord Bot - Payout Model
const { DataTypes } = require('sequelize');
const { sequelize } = require('../dbInit');

const Payout = sequelize.define('Payout', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  eventId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id'
    }
  },
  betId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'bets',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Discord user ID of the recipient'
  },
  userTag: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Discord username#discriminator of the recipient'
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Payout amount in coins'
  },
  feeAmount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Fee amount deducted from winnings'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'expired'),
    allowNull: false,
    defaultValue: 'pending'
  },
  method: {
    type: DataTypes.ENUM('bank', 'paypal', 'cashapp', 'venmo', 'other'),
    allowNull: true,
    comment: 'Payment method used'
  },
  accountId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Account ID for the payment method'
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Transaction ID for the payment'
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the payout was processed'
  },
  processedBy: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Discord user ID of who processed the payout'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the payout expires'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes about the payout'
  },
  meta: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('meta');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('meta', JSON.stringify(value));
    },
    comment: 'Additional metadata for the payout'
  }
}, {
  tableName: 'payouts',
  indexes: [
    {
      name: 'idx_payouts_user',
      fields: ['userId']
    },
    {
      name: 'idx_payouts_bet',
      fields: ['betId']
    },
    {
      name: 'idx_payouts_event',
      fields: ['eventId']
    },
    {
      name: 'idx_payouts_status',
      fields: ['status']
    },
    {
      name: 'idx_payouts_expires',
      fields: ['expiresAt']
    }
  ]
});

module.exports = Payout;