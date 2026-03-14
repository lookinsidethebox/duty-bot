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
  getMoneyHistoryOptions,
  getMoneyHistory,
  getMoneyRecentHistory,
  isMoneyManager,
  getMoneyAccessDeniedMessage,
  getMoneyRemoveOptions,
  getMoneyAddOptions,
  getMoneyOutcomeTypeOptions,
  getMoneyCurrencyOptions,
  getMoneyModerOptions,
  getMoneyModerByNickname,
  getMoneyEntryPrompt,
  parseMoneyEntryInput,
  getMoneyEntrySuccessMessage,
  saveMoneyEntry,
  removeMoneyEntry,
  getMoneyEntryRemovedMessage,
  getDefaultHostingEntryData,
  getMoneyHostingPromptOptions,
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

const clearActionMessage = async (ctx, fallbackText = '✅ Готово.') => {
  try {
    await ctx.deleteMessage();
    return;
  } catch (error) {}

  try {
    await ctx.editMessageText(fallbackText, { parse_mode: 'HTML' });
    return;
  } catch (error) {}

  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch (error) {}
};

const MONEY_OPERATION_TYPES = {
  income: 'income',
  outcome: 'outcome',
};

const MONEY_CURRENCIES = {
  eur: 'eur',
  rub: 'rub',
};

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
  { command: 'money_add', description: 'Добавить запись в финансы' },
  { command: 'money_remove', description: 'Удалить запись из финансов' },
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

bot.hears(/^\d{4}-\d{2}-\d{2}$/, async (ctx, next) => {
  const userId = ctx.from.id;

  if (userState[userId] === 'awaiting_circle_start_date') {
    const newDate = ctx.message.text.trim();
    await setCircleStartDateManually(newDate);
    userState[userId] = null;
    await ctx.reply(`Дата начала круга успешно установлена: ${newDate}`);
    return;
  }

  return next();
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

bot.command('money', (ctx) => {
  const result = getMoneyHistoryOptions();

  if (typeof result === 'string') {
    ctx.reply(result, { parse_mode: 'HTML' });
  } else {
    ctx.reply(result.message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: result.buttons,
      },
    });
  }
});

bot.action(/money_year_.+/, async (ctx) => {
  const data = ctx.match[0];
  const selectedYear = data.replace('money_year_', '');
  const message = getMoneyHistory(selectedYear);
  await ctx.reply(message, { parse_mode: 'HTML' });
  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.action('money_period_last_3_months', async (ctx) => {
  const message = getMoneyRecentHistory();
  await ctx.reply(message, { parse_mode: 'HTML' });
  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.command('money_remove', async (ctx) => {
  if (!isMoneyManager(ctx.from.id)) {
    await ctx.reply(getMoneyAccessDeniedMessage(), { parse_mode: 'HTML' });
    return;
  }

  const options = getMoneyRemoveOptions();

  if (typeof options === 'string') {
    await ctx.reply(options, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply(options.message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: options.buttons,
    },
  });
});

bot.command('money_add', async (ctx) => {
  if (!isMoneyManager(ctx.from.id)) {
    await ctx.reply(getMoneyAccessDeniedMessage(), { parse_mode: 'HTML' });
    return;
  }

  const options = getMoneyAddOptions();

  await ctx.reply(options.message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: options.buttons,
    },
  });
});

bot.action(/money_add_(income|outcome)/, async (ctx) => {
  if (!isMoneyManager(ctx.from.id)) {
    await ctx.reply(getMoneyAccessDeniedMessage(), { parse_mode: 'HTML' });
    await clearActionMessage(ctx, '⛔ Доступ запрещён.');
    ctx.answerCbQuery();
    return;
  }

  const operationType = ctx.match[1];

  if (operationType === MONEY_OPERATION_TYPES.outcome) {
    userState[ctx.from.id] = {
      type: 'awaiting_money_outcome_type',
      operationType,
    };

    const options = getMoneyOutcomeTypeOptions();

    await ctx.reply(options.message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: options.buttons,
      },
    });
  } else {
    userState[ctx.from.id] = {
      type: 'awaiting_money_currency',
      operationType,
    };

    const options = getMoneyCurrencyOptions();

    await ctx.reply(options.message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: options.buttons,
      },
    });
  }

  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.action(/money_outcome_type_(hosting|domain)/, async (ctx) => {
  if (!isMoneyManager(ctx.from.id)) {
    await ctx.reply(getMoneyAccessDeniedMessage(), { parse_mode: 'HTML' });
    await ctx.deleteMessage();
    ctx.answerCbQuery();
    return;
  }

  userState[ctx.from.id] = {
    type: 'awaiting_money_entry',
    operationType: MONEY_OPERATION_TYPES.outcome,
    outcomeType: ctx.match[1],
  };

  const options = getMoneyHostingPromptOptions(userState[ctx.from.id]);
  const replyOptions = { parse_mode: 'HTML' };

  if (options.buttons) {
    replyOptions.reply_markup = { inline_keyboard: options.buttons };
  }

  await ctx.reply(options.message, replyOptions);
  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.action('money_hosting_default_today', async (ctx) => {
  if (!isMoneyManager(ctx.from.id)) {
    await ctx.reply(getMoneyAccessDeniedMessage(), { parse_mode: 'HTML' });
    await ctx.deleteMessage();
    ctx.answerCbQuery();
    return;
  }

  userState[ctx.from.id] = null;
  const savedEntry = await saveMoneyEntry(getDefaultHostingEntryData());

  if (!savedEntry) {
    await ctx.reply('⛔ Не удалось сохранить запись в money.json.', { parse_mode: 'HTML' });
    await ctx.deleteMessage();
    ctx.answerCbQuery();
    return;
  }

  await ctx.reply(getMoneyEntrySuccessMessage(savedEntry), { parse_mode: 'HTML' });
  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.action(/money_currency_(income)_(eur|rub)/, async (ctx) => {
  if (!isMoneyManager(ctx.from.id)) {
    await ctx.reply(getMoneyAccessDeniedMessage(), { parse_mode: 'HTML' });
    await ctx.deleteMessage();
    ctx.answerCbQuery();
    return;
  }

  const currency = ctx.match[2];
  userState[ctx.from.id] = {
    type: 'awaiting_money_moder',
    operationType: MONEY_OPERATION_TYPES.income,
    currency,
  };

  const options = getMoneyModerOptions();

  await ctx.reply(options.message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: options.buttons,
    },
  });
  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.action(/money_moder_(.+)/, async (ctx) => {
  if (!isMoneyManager(ctx.from.id)) {
    await ctx.reply(getMoneyAccessDeniedMessage(), { parse_mode: 'HTML' });
    await ctx.deleteMessage();
    ctx.answerCbQuery();
    return;
  }

  const moder = getMoneyModerByNickname(ctx.match[1]);

  if (!moder) {
    await ctx.reply('⛔ Не удалось найти модера для пополнения.', { parse_mode: 'HTML' });
    await ctx.deleteMessage();
    ctx.answerCbQuery();
    return;
  }

  const previousState = userState[ctx.from.id];
  userState[ctx.from.id] = {
    type: 'awaiting_money_entry',
    operationType: MONEY_OPERATION_TYPES.income,
    currency: previousState?.currency || MONEY_CURRENCIES.eur,
    moderName: moder.name,
  };

  await ctx.reply(getMoneyEntryPrompt(userState[ctx.from.id]), { parse_mode: 'HTML' });
  await ctx.deleteMessage();
  ctx.answerCbQuery();
});

bot.action(/money_remove_entry_(\d+)/, async (ctx) => {
  if (!isMoneyManager(ctx.from.id)) {
    await ctx.reply(getMoneyAccessDeniedMessage(), { parse_mode: 'HTML' });
    await clearActionMessage(ctx, '⛔ Доступ запрещён.');
    ctx.answerCbQuery();
    return;
  }

  const removedEntry = await removeMoneyEntry(ctx.match[1]);

  if (!removedEntry) {
    await ctx.reply('⛔ Не удалось удалить запись из money.json.', { parse_mode: 'HTML' });
    await clearActionMessage(ctx, '⛔ Не удалось удалить запись.');
    ctx.answerCbQuery();
    return;
  }

  await ctx.reply(getMoneyEntryRemovedMessage(removedEntry), { parse_mode: 'HTML' });
  await clearActionMessage(ctx, '✅ Запись удалена.');
  ctx.answerCbQuery();
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

bot.on('text', async (ctx, next) => {
  const state = userState[ctx.from.id];

  if (!state || state.type !== 'awaiting_money_entry') {
    return next();
  }

  if (!isMoneyManager(ctx.from.id)) {
    userState[ctx.from.id] = null;
    await ctx.reply(getMoneyAccessDeniedMessage(), { parse_mode: 'HTML' });
    return;
  }

  const input = ctx.message.text.trim();

  if (['отмена', '/cancel', 'cancel'].includes(input.toLowerCase())) {
    userState[ctx.from.id] = null;
    await ctx.reply('✅ Добавление записи отменено.', { parse_mode: 'HTML' });
    return;
  }

  const parsedEntry = parseMoneyEntryInput(input, state);

  if (parsedEntry.error) {
    await ctx.reply(parsedEntry.error, { parse_mode: 'HTML' });
    return;
  }

  const savedEntry = await saveMoneyEntry(parsedEntry);
  userState[ctx.from.id] = null;

  if (!savedEntry) {
    await ctx.reply('⛔ Не удалось сохранить запись в money.json.', { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply(getMoneyEntrySuccessMessage(savedEntry), { parse_mode: 'HTML' });
});

cron.schedule('0 7 * * 1', async () => {
  const message = getMondayReminder();
  await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
  createLog(`Понедельничное напоминание отправлено: ${message}`);
});

cron.schedule('0 17 * * 0', async () => {
  const message = getSundayReminder();
  await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
  createLog(`Воскресное напоминание отправлено: ${message}`);
});

cron.schedule('0 0 * * *', async () => {
  const message = makeEverydayMaintenance();

  if (message) {
    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
  }
});

module.exports = bot;
