const { createLog } = require('./logService');
const bot = require('./bot');
bot.launch({ dropPendingUpdates: true });
createLog('Bot is running...');
