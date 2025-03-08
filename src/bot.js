const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const { botToken, chatId, trustedIds, rulesLink } = require('./config');
const { setCircleStartDateManually } = require('./paramsService');
const { createLog } = require('./logService');
const {
  getDuty,
  getMyDuty,
  getFormattedDutyList,
  getMondayReminder,
  getSundayReminder,
  getMiniModersList,
  getMoneyInfo,
  getNextDutySlots,
  assignDuty,
  getDutiesToRemove,
  removeUserDuty,
  makeEverydayMaintenance,
  getHistoryYears,
  getHistory,
  getHolidayList,
} = require('./botService');

const bot = new Telegraf(botToken);
const userState = {};

const isTrustedChat = (ctx) => {
  return ctx.chat && trustedIds.includes(ctx.chat.id.toString());
};

bot.use(async (ctx, next) => {
  if (isTrustedChat(ctx)) {
    return next();
  } else {
    const commandText = ctx.message && ctx.message.text ? ctx.message.text : 'неизвестная команда';
    const chatText = ctx.chat && ctx.chat.id ? ctx.chat.id : 'неизвестный пользователь';
    createLog(`⛔ Команда ${commandText} отклонена: ${chatText} не доверенный.`);
    await ctx.reply('⛔ Извините, вам запрещено пользоваться этим ботом.');
  }
});

bot.telegram.setMyCommands([
  { command: 'blame', description: 'Кто сегодня дежурный?' },
  { command: 'doom', description: 'Когда я дежурю?' },
  { command: 'list', description: 'График дежурств' },
  { command: 'assign', description: 'Записаться на дежурство' },
  { command: 'remove', description: 'Удалить дежурство' },
  { command: 'history', description: 'Посмотреть историю дежурств' },
  { command: 'mini_moders', description: 'Список мини-модеров' },
  { command: 'holidays', description: 'Список праздников' },
  { command: 'rules', description: 'Памятка дежурного' },
  { command: 'money', description: 'Отчет по оплате за хостинг' },
  // { command: 'test_maintenance', description: 'Тест makeEverydayMaintenance' },
  // { command: 'test_monday', description: 'Тест getMondayReminder' },
  // { command: 'test_sunday', description: 'Тест getSundayReminder' },
]);

bot.command('blame', async (ctx) => {
  await ctx.reply(getDuty(), { parse_mode: 'HTML' });
});

bot.hears(/кто дежурный\??/i, async (ctx) => {
  await ctx.reply(getDuty(), { parse_mode: 'HTML' });
});

bot.command('doom', async (ctx) => {
  await ctx.reply(getMyDuty(ctx.from.username), { parse_mode: 'HTML' });
});

bot.hears(/когда я дежурю\??/i, async (ctx) => {
  await ctx.reply(getMyDuty(ctx.from.username), { parse_mode: 'HTML' });
});

bot.hears('set_circle_start_date', async (ctx) => {
  const userId = ctx.from.id;
  userState[userId] = 'awaiting_circle_start_date';
  await ctx.reply('Пожалуйста, отправь дату в формате YYYY-MM-DD.');
});

bot.hears(/^\d{4}-\d{2}-\d{2}$/, async (ctx) => {
  const userId = ctx.from.id;

  if (userState[userId] === 'awaiting_circle_start_date') {
    const newDate = ctx.message.text.trim();
    await setCircleStartDateManually(newDate);
    userState[userId] = null;
    await ctx.reply(`Дата начала круга успешно установлена: ${newDate}`);
  }
});

bot.command('list', async (ctx) => {
  await ctx.reply(getFormattedDutyList(), { parse_mode: 'HTML' });
});

bot.command('assign', (ctx) => {
  const result = getNextDutySlots(ctx.from.username);

  if (typeof result === 'string') {
    ctx.reply(result, { parse_mode: 'HTML' });
  } else {
    const buttons = result.map((slot) => [
      { text: slot.label, callback_data: `select_slot_${slot.startDate}` },
    ]);

    ctx.reply('📋 <b>Свободные слоты для дежурства:</b>', {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }
});

bot.action(/select_slot_.+/, async (ctx) => {
  const data = ctx.match[0];
  const selectedDate = data.replace('select_slot_', '');
  const message = await assignDuty(ctx.from.username, selectedDate);
  await ctx.reply(message, { parse_mode: 'HTML' });
  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.command('remove', (ctx) => {
  const result = getDutiesToRemove(ctx.from.username);

  if (typeof result === 'string') {
    ctx.reply(result, { parse_mode: 'HTML' });
  } else {
    const buttons = result.map((duty) => [
      { text: duty.label, callback_data: `remove_duty_${duty.startDate}` },
    ]);

    ctx.reply('❗<b>Какое дежурство ты хочешь удалить?</b>', {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }
});

bot.action(/remove_duty_.+/, async (ctx) => {
  const data = ctx.match[0];
  const selectedDate = data.replace('remove_duty_', '');
  const message = await removeUserDuty(ctx.from.username, selectedDate);
  await ctx.reply(message, { parse_mode: 'HTML' });
  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.command('history', (ctx) => {
  const result = getHistoryYears();

  if (typeof result === 'string') {
    ctx.reply(result, { parse_mode: 'HTML' });
  } else {
    const buttons = result.map((year) => [{ text: year, callback_data: `history_year_${year}` }]);

    ctx.reply('❗<b>Историю за какой год ты хочешь посмотреть?</b>', {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }
});

bot.action(/history_year_.+/, async (ctx) => {
  const data = ctx.match[0];
  console.log('data: ', data);
  const selectedYear = data.replace('history_year_', '');
  const message = getHistory(selectedYear);
  await ctx.reply(message, { parse_mode: 'HTML' });
  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.command('rules', async (ctx) => {
  await ctx.reply(`📋 <b>Памятка для дежурного:</b>\n ${rulesLink}`, {
    parse_mode: 'HTML',
  });
});

bot.command('money', async (ctx) => {
  await ctx.reply(getMoneyInfo(), { parse_mode: 'HTML' });
});

bot.command('mini_moders', async (ctx) => {
  await ctx.reply(getMiniModersList(), { parse_mode: 'HTML' });
});

bot.command('holidays', async (ctx) => {
  await ctx.reply(getHolidayList(), { parse_mode: 'HTML' });
});

bot.command('test_monday', async (ctx) => {
  await ctx.reply(getMondayReminder(), { parse_mode: 'HTML' });
});

bot.command('test_sunday', async (ctx) => {
  await ctx.reply(getSundayReminder(), { parse_mode: 'HTML' });
});

bot.command('test_maintenance', async (ctx) => {
  const message = makeEverydayMaintenance();

  if (message) {
    await ctx.reply(message, { parse_mode: 'HTML' });
  }
});

cron.schedule('0 10 * * 1', async () => {
  const message = getMondayReminder();
  await bot.telegram.sendMessage(chatId, message);
  createLog(`Понедельничное напоминание отправлено: ${message}`);
});

cron.schedule('0 20 * * 0', async () => {
  const message = getSundayReminder();
  await bot.telegram.sendMessage(chatId, message);
  createLog(`Воскресное напоминание отправлено: ${message}`);
});

cron.schedule('0 0 * * *', async () => {
  const message = makeEverydayMaintenance();

  if (message) {
    await bot.telegram.sendMessage(chatId, message);
  }
});

module.exports = bot;
