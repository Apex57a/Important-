// KrayStakes Discord Bot - Bet Model
const { DataTypes } = require('sequelize');
const { sequelize } = require('../dbInit');

const Bet = sequelize.define('Bet', {
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
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Discord user ID of the bettor'
  },
  userTag: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Discord username#discriminator of the bettor'
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    },
    comment: 'Bet amount in coins'
  },
  choiceIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Index of the selected choice in the event.choices array'
  },
  choiceName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Name of the selected choice (for easier querying)'
  },
  status: {
    type: DataTypes.ENUM('active', 'won', 'lost', 'refunded', 'cancelled'),
    allowNull: false,
    defaultValue: 'active'
  },
  odds: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Calculated odds at the time of bet placement'
  },
  potentialWinnings: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Potential winnings calculated at time of bet placement'
  },
  actualWinnings: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Actual winnings after event completion'
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
    comment: 'Additional metadata for the bet'
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the bet was cancelled (if applicable)'
  },
  cancelledBy: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Discord user ID of who cancelled the bet (if applicable)'
  }
}, {
  tableName: 'bets',
  indexes: [
    {
      name: 'idx_bets_user_event',
      fields: ['userId', 'eventId']
    },
    {
      name: 'idx_bets_status',
      fields: ['status']
    },
    {
      name: 'idx_bets_choice',
      fields: ['eventId', 'choiceIndex']
    }
  ]
});

module.exports = Bet;