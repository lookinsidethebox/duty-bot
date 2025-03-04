const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const { botToken, chatId, trustedIds, rulesLink } = require('./config');
const { removeFinishedDuty } = require('./dutyService');
const {
  getDuty,
  getFormattedDutyList,
  getMondayReminder,
  getSundayReminder,
  getMiniModersList,
  getMoneyInfo,
  getNextDutySlots,
  assignDuty,
} = require('./botService');

const bot = new Telegraf(botToken);

const isTrustedChat = (ctx) => {
  return ctx.chat && trustedIds.includes(ctx.chat.id.toString());
};

bot.use(async (ctx, next) => {
  if (isTrustedChat(ctx)) {
    return next();
  } else {
    console.log(`⛔ Команда отклонена: чат ${ctx.chat?.id} не доверенный.`);
    await ctx.reply('⛔ Извините, вам запрещено пользоваться этим ботом.');
  }
});

bot.telegram.setMyCommands([
  { command: 'blame', description: 'Кто сегодня дежурный?' },
  { command: 'list', description: 'График дежурств' },
  { command: 'assign', description: 'Записаться на дежурство' },
  { command: 'mini_moders', description: 'Список мини-модеров' },
  { command: 'rules', description: 'Памятка дежурного' },
  { command: 'money', description: 'Отчет по оплате за хостинг' },
  // { command: 'test_monday', description: 'Тест getMondayReminder' },
  // { command: 'test_sunday', description: 'Тест getSundayReminder' },
  // { command: 'test_remove', description: 'Тест removeFinishedDuty' },
]);

bot.command('blame', async (ctx) => {
  await ctx.reply(getDuty(), { parse_mode: 'HTML' });
});

bot.hears(/кто дежурный\??/i, async (ctx) => {
  await ctx.reply(getDuty());
});

bot.command('list', async (ctx) => {
  await ctx.reply(getFormattedDutyList(), { parse_mode: 'HTML' });
});

bot.command('assign', (ctx) => {
  const slots = getNextDutySlots();

  const buttons = slots.map((slot) => [
    { text: slot.label, callback_data: `select_slot_${slot.startDate}` },
  ]);

  ctx.reply('📋 <b>Свободные слоты для дежурства:</b>', {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
});

bot.action(/select_slot_.+/, async (ctx) => {
  const data = ctx.match[0];
  const selectedDate = data.replace('select_slot_', '');
  const message = await assignDuty(ctx.from.username, selectedDate);
  await ctx.reply(message);
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

bot.command('test_monday', async (ctx) => {
  await ctx.reply(getMondayReminder(), { parse_mode: 'HTML' });
});

bot.command('test_sunday', async (ctx) => {
  await ctx.reply(getSundayReminder(), { parse_mode: 'HTML' });
});

bot.command('test_remove', async (ctx) => {
  removeFinishedDuty();
});

cron.schedule('0 10 * * 1', async () => {
  const message = getMondayReminder();
  await bot.telegram.sendMessage(chatId, message);
  console.log('Понедельничное напоминание отправлено: ', message);
});

cron.schedule('0 20 * * 0', async () => {
  const message = getSundayReminder();
  await bot.telegram.sendMessage(chatId, message);
  console.log('Воскресное напоминание отправлено: ', message);
});

cron.schedule('0 0 * * 1', async () => {
  removeFinishedDuty();
});

module.exports = bot;
