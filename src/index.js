const { createLog } = require('./logService');
const { botName } = require('./config');

const bot = require('./bot');
bot.launch({ dropPendingUpdates: true });
createLog(`${botName} is running...`);
