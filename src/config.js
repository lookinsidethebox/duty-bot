require('dotenv').config();

module.exports = {
  botToken: process.env.BOT_TOKEN,
  chatId: process.env.CHAT_ID,
  trustedIds: process.env.TRUSTED_IDS.split(',').map((id) => id.trim()),
  rulesLink: process.env.RULES_LINK,
  moneyLink: process.env.MONEY_LINK,
  tinkoffCard: process.env.TINKOFF_CARD,
  hipotekarnaCard: process.env.HIPOTEKARNA_CARD,
};
