const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
dotenv.config({ path: envFile });

module.exports = {
  botToken: process.env.BOT_TOKEN,
  botName: process.env.BOT_NAME,
  chatId: process.env.CHAT_ID,
  trustedIds: process.env.TRUSTED_IDS.split(',').map((id) => id.trim()),
  rulesLink: process.env.RULES_LINK,
  moneyLink: process.env.MONEY_LINK,
  tinkoffCard: process.env.TINKOFF_CARD,
  hipotekarnaCard: process.env.HIPOTEKARNA_CARD,
  filesFolderName: process.env.DATA_FOLDER_NAME,
  modersFileName: process.env.MODERS_FILE_NAME,
  miniModersFileName: process.env.MINI_MODERS_FILE_NAME,
  dutyFileName: process.env.DUTY_FILE_NAME,
  paramsFileName: process.env.PARAMS_FILE_NAME,
};
