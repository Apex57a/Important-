// KrayStakes Discord Bot - Models Index
const Event = require('./event');
const Bet = require('./bet');
const Payout = require('./payout');
const Log = require('./log');
const Configuration = require('./configuration');

// Define model relationships

// Event -> Bets (one-to-many)
Event.hasMany(Bet, {
  foreignKey: 'eventId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Bet.belongsTo(Event, {
  foreignKey: 'eventId'
});

// Event -> Payouts (one-to-many)
Event.hasMany(Payout, {
  foreignKey: 'eventId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Payout.belongsTo(Event, {
  foreignKey: 'eventId'
});

// Bet -> Payouts (one-to-many)
Bet.hasMany(Payout, {
  foreignKey: 'betId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Payout.belongsTo(Bet, {
  foreignKey: 'betId'
});

module.exports = {
  Event,
  Bet,
  Payout,
  Log,
  Configuration
};