const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const {
  botToken,
  chatId,
  trustedIds,
  rulesLink,
  moneyLink,
} = require('./config');
const { removeFinishedDuty } = require('./dutyService');
const {
  getDuty,
  getFormattedDutyList,
  getMondayReminder,
  getSundayReminder,
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
  { command: 'rules', description: 'Памятка дежурного' },
  { command: 'money', description: 'Отчет по оплате за хостинг' },
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

bot.command('rules', async (ctx) => {
  await ctx.reply(`📋 <b>Памятка для дежурного:</b>\n ${rulesLink}`, {
    parse_mode: 'HTML',
  });
});

bot.command('money', async (ctx) => {
  await ctx.reply(`📋 <b>Отчет по оплате за хостинг:</b>\n ${moneyLink}`, {
    parse_mode: 'HTML',
  });
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
