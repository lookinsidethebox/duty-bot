const moment = require('moment');
require('moment/locale/ru');
moment.locale('ru');
const { rulesLink, moneyLink, tinkoffCard, hipotekarnaCard } = require('./config');
const { createLog } = require('./logService');
const { addCurrentDutyToHistory, getYearsList, getHistoryByYear } = require('./historyService');
const {
  getMoneyYearsList,
  getMoneyHistoryByYear,
  getMoneyHistoryForLastMonths,
  addMoneyEntry,
  getRecentMoneyEntries,
  removeMoneyEntryByIndex,
} = require('./moneyService');
const {
  getHolidaysFormatted,
  getTodayHoliday,
  getTodayHolidayReminder,
} = require('./holidaysService');
const {
  getCurrentDuty,
  getByStartDate,
  getByEndDate,
  getDutiesFormattedList,
  getAvailableSlots,
  createDuty,
  getUserDuties,
  removeDuty,
  removeFinishedDuties,
} = require('./dutyService');
const {
  getModers,
  getModerName,
  getMiniModers,
  getModersNotOnDuty,
  getModerByTelegramId,
  getModerByUsername,
  getModerWhoHasBirthdayToday,
} = require('./userService');
const {
  getCircleStartDate,
  getCircleFinishDate,
  getEuroExchangeRate,
  getHostingDefaultAmount,
  isCircleStartDateToday,
  updateCircleStartDate,
  isMondayToday,
} = require('./paramsService');

const MONEY_MANAGER_NAME = 'Тлен';
const MONEY_OPERATION_TYPES = {
  income: 'income',
  outcome: 'outcome',
};
const MONEY_CURRENCIES = {
  eur: 'eur',
  rub: 'rub',
};
const MONEY_OUTCOME_TYPES = {
  hosting: 'hosting',
  domain: 'domain',
};

const getDuty = () => {
  const currentDuty = getCurrentDuty();

  if (currentDuty) {
    const moderName = getModerName(currentDuty.name);
    return `<b>Дежурный</b>: ${moderName}`;
  } else {
    return 'Дежурного нет, никто не записался 😢';
  }
};

const getMyDuty = (username) => {
  const duties = getDutiesToRemove(username);

  if (typeof duties === 'string') {
    return duties;
  }

  let message = `📋 <b>Список твоих дежурств:</b>\n\n`;

  duties.map((duty) => {
    message += `${duty.label}\n`;
  });

  return message.trim();
};

const getFormattedDutyList = () => {
  const dutiesByMonth = getDutiesFormattedList();

  if (!dutiesByMonth) {
    return 'График дежурств пуст 😢';
  }

  let message = '📋 <b>График дежурств:</b>\n';
  let previousDutyEndDate = null;
  let currentMonth = '';
  const circleStartDate = getCircleStartDate();
  const circleFinishDate = getCircleFinishDate();
  let isCircleStartDateSet = false;
  let isCircleFinishDateSet = false;

  Object.keys(dutiesByMonth).forEach((month) => {
    const monthDuties = dutiesByMonth[month];

    monthDuties.forEach((duty) => {
      const startDateStr = duty.startDate.format('DD MMMM');
      const endDateStr = duty.endDate.format('DD MMMM');
      const dutyMonth = getCapitalizedMonth(duty.startDate.format('MMMM YYYY'));

      if (previousDutyEndDate) {
        const gapInDays = duty.startDate.diff(previousDutyEndDate, 'days');

        if (gapInDays > 1) {
          let missingStart = previousDutyEndDate.clone().add(1, 'day');

          while (missingStart.isBefore(duty.startDate)) {
            let missingEnd = missingStart.clone().add(6, 'day');
            const missingMonth = getCapitalizedMonth(missingStart.format('MMMM YYYY'));

            if (missingStart >= circleStartDate && !isCircleStartDateSet) {
              message += '\n 🚀 Начало нового круга \n\n';
              isCircleStartDateSet = true;
            }

            const nextWeekStartDate = missingStart.clone().add(1, 'day');
            if (nextWeekStartDate >= circleFinishDate && !isCircleFinishDateSet) {
              message += '\n 🏁 Конец круга \n\n';
              isCircleFinishDateSet = true;
            }

            if (missingMonth !== currentMonth) {
              message += `\n<b>${missingMonth}:</b>\n`;
              currentMonth = missingMonth;
            }

            message += `${missingStart.format('DD MMMM')} — ${missingEnd.format(
              'DD MMMM',
            )}: ❗<b>Дежурного нет</b>\n`;
            missingStart = missingEnd.clone().add(1, 'day');
          }
        }
      }

      if (dutyMonth !== currentMonth) {
        message += `\n<b>${dutyMonth}:</b>\n`;
        currentMonth = dutyMonth;
      }

      if (duty.startDate >= circleStartDate && !isCircleStartDateSet) {
        message += '\n 🚀 Начало нового круга \n\n';
        isCircleStartDateSet = true;
      }

      if (duty.startDate >= circleFinishDate && !isCircleFinishDateSet) {
        message += '\n 🏁 Конец круга \n\n';
        isCircleFinishDateSet = true;
      }

      message += `${startDateStr} — ${endDateStr}: ${duty.name}\n`;
      previousDutyEndDate = duty.endDate.clone();
    });
  });

  if (!isCircleFinishDateSet) {
    message += '\n 🏁 Конец круга\n';
  }

  message += getModersNotOnDutyMessage();

  message += '\nЗаписаться на новое дежурство: /assign';
  return message.trim();
};

const getCapitalizedMonth = (month) => {
  return month.charAt(0).toUpperCase() + month.slice(1);
};

const getModersNotOnDutyMessage = () => {
  const modersNotOnDuty = getModersNotOnDuty();

  if (modersNotOnDuty.length === 0) {
    return '';
  }

  let message = `\n\n❗<b>Модеры, не записавшиеся на дежурство:</b>\n`;
  modersNotOnDuty.forEach((moder) => {
    message += `${getModerName(moder.name)}\n`;
  });

  return message.trimEnd();
};

const getNextDutySlots = (username) => {
  const moder = getModerByUsername(username);

  if (!moder) {
    return '⛔ Извини, я не нашел тебя в списке модеров. Ты не можешь записаться на дежурство.';
  }

  const result = getAvailableSlots(moder.name);

  if (typeof result === 'string') {
    return result;
  }

  return result.map((slot) => ({
    startDate: slot.startDate,
    label: `${slot.startDate} — ${slot.endDate}`,
  }));
};

const assignDuty = async (username, selectedDate) => {
  const moder = getModerByUsername(username);

  if (!moder) {
    return '⛔ Извини, я не нашел тебя в списке модеров. Запись не добавлена.';
  }

  await createDuty(moder.name, selectedDate);
  const list = getFormattedDutyList();
  return `✅ Запись успешно добавлена! Твое дежурство будет начинаться с ${selectedDate}.\n\n${list}`;
};

const getDutiesToRemove = (username) => {
  const moder = getModerByUsername(username);

  if (!moder) {
    return '⛔ Извини, я не нашел тебя в списке модеров.';
  }

  const duties = getUserDuties(moder.name);

  if (duties.length === 0) {
    return '⛔ Извини, я не нашел твои дежурства в списке.';
  }

  return duties;
};

const removeUserDuty = async (username, selectedDate) => {
  const duties = getDutiesToRemove(username);

  if (typeof duties === 'string') {
    return duties;
  }

  const dutyToRemove = duties.find((duty) => duty.startDate === selectedDate);

  if (!dutyToRemove) {
    return '⛔ Кажется, ты пытаешься удалить чужое или несуществующее дежурство.';
  }

  await removeDuty(dutyToRemove);
  const list = getFormattedDutyList();
  return `✅ Дежурство успешно удалено!\n\n${list}`;
};

const getHistoryYears = () => {
  const years = getYearsList();

  if (!years || years.length === 0) {
    return 'К сожалению, в истории пока пусто 😢';
  }

  return years;
};

const getHistory = (year) => {
  const history = getHistoryByYear(year);

  if (!history || history.length === 0) {
    return 'К сожалению, история за этот год отсутствует 😢';
  }

  let message = `📋 <b>История дежурств за ${year}:</b>\n\n`;

  history.map((item) => {
    message += `${item.startDate} — ${item.endDate}: ${item.name}\n`;
  });

  return message.trim();
};

const getMoneyYears = () => {
  const years = getMoneyYearsList();

  if (!years || years.length === 0) {
    return 'К сожалению, история пополнений и вычетов пока пуста 😢';
  }

  return years;
};

const getMoneyHistoryOptions = () => {
  const years = getMoneyYears();

  if (typeof years === 'string') {
    return years;
  }

  const buttons = [
    [{ text: 'За последние 3 месяца', callback_data: 'money_period_last_3_months' }],
    ...years.map((year) => [{ text: year, callback_data: `money_year_${year}` }]),
  ];

  return {
    message: '❗<b>Историю пополнений и вычетов за какой период ты хочешь посмотреть?</b>',
    buttons,
  };
};

const formatMoneyValue = (value, currencySymbol) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.replace(/EUR/g, '€').replace(/RUB/g, '₽');

    if (/[€₽$]/.test(normalizedValue)) {
      return normalizedValue;
    }

    return `${normalizedValue} ${currencySymbol}`;
  }

  return `${value} ${currencySymbol}`;
};

const getMoneyEntryAmount = (entry) => {
  const incomeEur = formatMoneyValue(entry.income_eur ?? entry.incomeEur, '€');
  const incomeRub = formatMoneyValue(entry.income_rub ?? entry.incomeRub, '₽');
  const outcome = formatMoneyValue(entry.outcome, '€');

  if (outcome) {
    return `${outcome.startsWith('-') ? '' : '-'}${outcome}`;
  }

  return [incomeEur, incomeRub ? `(${incomeRub})` : null].filter(Boolean).join(' ');
};

const getMoneyHistory = (year) => {
  const history = getMoneyHistoryByYear(year);

  if (!history || history.length === 0) {
    return 'К сожалению, история пополнений и вычетов за этот год отсутствует 😢';
  }

  let message = `📋 <b>История пополнений и вычетов за ${year}:</b>\n\n`;

  history.forEach((item) => {
    const incomeEur = formatMoneyValue(item.incomeEur, '€');
    const incomeRub = formatMoneyValue(item.incomeRub, '₽');
    const outcome = formatMoneyValue(item.outcome, '€');
    const balance = formatMoneyValue(item.balance, '€');
    const operationAmount = outcome
      ? `${outcome.startsWith('-') ? '' : '-'}${outcome}`
      : [incomeEur, incomeRub ? `(${incomeRub})` : null].filter(Boolean).join(' ');

    message += `<b>${item.date}</b>\n`;
    message += operationAmount
      ? `${item.description}: ${operationAmount}\n`
      : `${item.description}\n`;
    message += balance ? `Баланс: ${balance}\n\n` : '\n';
  });

  return message.trim();
};

const getMoneyRecentHistory = () => {
  const history = getMoneyHistoryForLastMonths(3);

  if (!history || history.length === 0) {
    return 'К сожалению, история пополнений и вычетов за последние 3 месяца отсутствует 😢';
  }

  let message = '📋 <b>История пополнений и вычетов за последние 3 месяца:</b>\n\n';

  history.forEach((item) => {
    const incomeEur = formatMoneyValue(item.incomeEur, '€');
    const incomeRub = formatMoneyValue(item.incomeRub, '₽');
    const outcome = formatMoneyValue(item.outcome, '€');
    const balance = formatMoneyValue(item.balance, '€');
    const operationAmount = outcome
      ? `${outcome.startsWith('-') ? '' : '-'}${outcome}`
      : [incomeEur, incomeRub ? `(${incomeRub})` : null].filter(Boolean).join(' ');

    message += `<b>${item.date}</b>\n`;
    message += operationAmount
      ? `${item.description}: ${operationAmount}\n`
      : `${item.description}\n`;
    message += balance ? `Баланс: ${balance}\n\n` : '\n';
  });

  return message.trim();
};

const isMoneyManager = (telegramId) => {
  const moder = getModerByTelegramId(telegramId);
  return Boolean(moder && moder.name === MONEY_MANAGER_NAME);
};

const getMoneyAccessDeniedMessage = () => {
  return '⛔ Этой командой может пользоваться только Тлен.';
};

const getMoneyRemoveOptions = () => {
  const entries = getRecentMoneyEntries(10);

  if (!entries || entries.length === 0) {
    return 'В истории пополнений и вычетов пока нечего удалять 😢';
  }

  return {
    message: '❗<b>Что из последних 10 записей ты хочешь удалить?</b>',
    buttons: entries.map((entry) => [
      {
        text: `${moment(entry.date).format('DD.MM.YYYY')} - ${entry.description}: ${getMoneyEntryAmount(entry)}`,
        callback_data: `money_remove_entry_${entry.index}`,
      },
    ]),
  };
};

const getMoneyAddOptions = () => {
  return {
    message: '❗<b>Что ты хочешь добавить в историю денег?</b>',
    buttons: [
      [{ text: 'Пополнение', callback_data: 'money_add_income' }],
      [{ text: 'Вычет', callback_data: 'money_add_outcome' }],
    ],
  };
};

const getMoneyOutcomeTypeOptions = () => {
  return {
    message: '❗<b>Что ты хочешь списать?</b>',
    buttons: [
      [{ text: 'Хостинг', callback_data: `money_outcome_type_${MONEY_OUTCOME_TYPES.hosting}` }],
      [{ text: 'Домен', callback_data: `money_outcome_type_${MONEY_OUTCOME_TYPES.domain}` }],
    ],
  };
};

const getMoneyCurrencyOptions = () => {
  return {
    message: '❗<b>В какой валюте ты хочешь внести пополнение?</b>',
    buttons: [
      [
        {
          text: '€ Евро',
          callback_data: `money_currency_${MONEY_OPERATION_TYPES.income}_${MONEY_CURRENCIES.eur}`,
        },
      ],
      [
        {
          text: '₽ Рубли',
          callback_data: `money_currency_${MONEY_OPERATION_TYPES.income}_${MONEY_CURRENCIES.rub}`,
        },
      ],
    ],
  };
};

const getMoneyModerOptions = () => {
  return {
    message: '❗<b>От какого модера пополнение?</b>',
    buttons: getModers().map((moder) => [
      { text: moder.name, callback_data: `money_moder_${moder.nickname}` },
    ]),
  };
};

const getMoneyModerByNickname = (nickname) => {
  return getModers().find((moder) => moder.nickname === nickname) || null;
};

const getOutcomeDescription = (outcomeType) => {
  return outcomeType === MONEY_OUTCOME_TYPES.domain ? 'Оплата домена' : 'Оплата хостинга';
};

const getIncomeDescription = (moderName) => {
  return `Пополнение (${moderName})`;
};

const getMoneyEntryPrompt = (state) => {
  const today = moment().format('YYYY-MM-DD');

  if (state.operationType === MONEY_OPERATION_TYPES.outcome) {
    const description = getOutcomeDescription(state.outcomeType);

    if (state.outcomeType === MONEY_OUTCOME_TYPES.hosting) {
      return (
        `📋 <b>${description}</b>\n\n` +
        'Можно отправить:\n' +
        `<code>${today}</code> — дефолтная сумма\n` +
        '<code>Сумма</code>\n' +
        `<code>Сумма | ${today}</code>\n\n` +
        `Дефолтная сумма хостинга: ${getHostingDefaultAmount()} €.\n` +
        'Если дату не указать, будет использована сегодняшняя.\n' +
        'Для отмены отправь: <code>отмена</code>'
      );
    }

    return (
      `📋 <b>${description}</b>\n\n` +
      'Отправь данные в одном сообщении:\n' +
      '<code>Сумма</code>\n' +
      'или\n' +
      `<code>Сумма | ${today}</code>\n\n` +
      'Если дату не указать, будет использована сегодняшняя.\n' +
      'Для отмены отправь: <code>отмена</code>'
    );
  }

  const currencyLabel = state.currency === MONEY_CURRENCIES.rub ? 'рублях' : 'евро';
  let message =
    `📋 <b>${getIncomeDescription(state.moderName)} в ${currencyLabel}</b>\n\n` +
    'Отправь данные в одном сообщении:\n' +
    '<code>Сумма</code>\n' +
    'или\n' +
    `<code>Сумма | ${today}</code>\n\n` +
    'Если дату не указать, будет использована сегодняшняя.\n';

  if (state.currency === MONEY_CURRENCIES.rub) {
    message += `Конвертация в евро произойдет автоматически по курсу: 1 € = ${getEuroExchangeRate()} ₽.\n`;
  }

  message += 'Для отмены отправь: <code>отмена</code>';
  return message;
};

const parseMoneyNumber = (value) => {
  if (!value) {
    return null;
  }

  const normalizedValue = value.replace(',', '.').trim();
  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const isValidMoneyDate = (value) => {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && moment(value, 'YYYY-MM-DD', true).isValid();
};

const roundToTwo = (value) => {
  return Math.round(value * 100) / 100;
};

const convertRubToEur = (rubAmount) => {
  const euroExchangeRate = getEuroExchangeRate();
  return roundToTwo(rubAmount / euroExchangeRate);
};

const parseMoneyEntryInput = (input, state) => {
  const rawParts = input.split('|').map((part) => part.trim());
  const dateRaw = rawParts.length > 1 ? rawParts[1] : null;

  if (rawParts.length < 1 || rawParts.length > 2) {
    return { error: getMoneyEntryPrompt(state) };
  }

  if (state.operationType === MONEY_OPERATION_TYPES.income) {
    const amountRaw = rawParts[0];
    const amount = parseMoneyNumber(amountRaw);
    const date = dateRaw ? dateRaw.trim() : moment().format('YYYY-MM-DD');

    if (amount === null || (dateRaw && !isValidMoneyDate(date))) {
      return { error: getMoneyEntryPrompt(state) };
    }

    if (state.currency === MONEY_CURRENCIES.rub) {
      return {
        date,
        description: getIncomeDescription(state.moderName),
        incomeEur: convertRubToEur(amount),
        incomeRub: amount,
        outcome: null,
      };
    }

    return {
      date,
      description: getIncomeDescription(state.moderName),
      incomeEur: amount,
      incomeRub: null,
      outcome: null,
    };
  }

  if (state.outcomeType === MONEY_OUTCOME_TYPES.hosting) {
    const singleValue = rawParts[0];
    const defaultAmount = getHostingDefaultAmount();

    if (rawParts.length === 1 && isValidMoneyDate(singleValue)) {
      return {
        date: singleValue,
        description: getOutcomeDescription(state.outcomeType),
        incomeEur: null,
        incomeRub: null,
        outcome: defaultAmount,
      };
    }

    const amount = parseMoneyNumber(singleValue);
    const date = dateRaw ? dateRaw.trim() : moment().format('YYYY-MM-DD');

    if (amount === null || (dateRaw && !isValidMoneyDate(date))) {
      return { error: getMoneyEntryPrompt(state) };
    }

    return {
      date,
      description: getOutcomeDescription(state.outcomeType),
      incomeEur: null,
      incomeRub: null,
      outcome: amount,
    };
  }

  const amountRaw = rawParts[0];
  const amount = parseMoneyNumber(amountRaw);
  const date = dateRaw ? dateRaw.trim() : moment().format('YYYY-MM-DD');

  if (amount === null || (dateRaw && !isValidMoneyDate(date))) {
    return { error: getMoneyEntryPrompt(state) };
  }

  return {
    date,
    description: getOutcomeDescription(state.outcomeType),
    incomeEur: null,
    incomeRub: null,
    outcome: amount,
  };
};

const getMoneyEntrySuccessMessage = (entry) => {
  const amount = getMoneyEntryAmount(entry);

  return (
    '✅ <b>Запись добавлена.</b>\n\n' +
    `<b>${moment(entry.date).format('DD MMMM')}</b>\n` +
    `${entry.description}: ${amount}\n` +
    `Баланс: ${entry.balance} €`
  );
};

const saveMoneyEntry = async (entryData) => {
  return addMoneyEntry(entryData);
};

const removeMoneyEntry = async (entryIndex) => {
  const normalizedEntryIndex = Number(entryIndex);

  if (!Number.isInteger(normalizedEntryIndex)) {
    return null;
  }

  return removeMoneyEntryByIndex(normalizedEntryIndex);
};

const getMoneyEntryRemovedMessage = (entry) => {
  const amount = getMoneyEntryAmount(entry);

  return (
    '✅ <b>Запись удалена.</b>\n\n' +
    `<b>${moment(entry.date).format('DD MMMM')}</b>\n` +
    `${entry.description}: ${amount}`
  );
};

const getDefaultHostingEntryData = (date = moment().format('YYYY-MM-DD')) => {
  return {
    date,
    description: getOutcomeDescription(MONEY_OUTCOME_TYPES.hosting),
    incomeEur: null,
    incomeRub: null,
    outcome: getHostingDefaultAmount(),
  };
};

const getMoneyHostingPromptOptions = (state) => {
  const result = { message: getMoneyEntryPrompt(state) };

  if (state.outcomeType === MONEY_OUTCOME_TYPES.hosting) {
    result.buttons = [
      [{ text: 'Сегодня, дефолтная сумма', callback_data: 'money_hosting_default_today' }],
    ];
  }

  return result;
};

const getMiniModersList = () => {
  const miniModers = getMiniModers();

  if (!miniModers || miniModers.length === 0) {
    return 'Минимодеров нет 😢';
  }

  let message = '📋 <b>Список минимодеров:</b>\n';
  miniModers.forEach((moder) => {
    message += `<b>${moder.name}</b> (@${moder.nickname}): ${moder.topics}\n`;
  });

  return message.trim();
};

const getHolidayList = () => {
  const holidays = getHolidaysFormatted();

  if (!holidays || holidays.length === 0) {
    return 'Праздников нет 😢';
  }

  let message = '📋 <b>Список праздников:</b>\n\n';
  holidays.forEach((holiday) => {
    message += `${holiday.date} — ${holiday.name}\n`;
  });

  return message.trim();
};

const getMondayReminder = () => {
  const todayDuty = getByStartDate();
  let message;

  if (todayDuty) {
    const moderName = getModerName(todayDuty.name);
    message = `🔔 <b>Напоминание:</b> с сегодняшнего дня дежурит ${moderName}!`;
  } else {
    message = '🔔 <b>Напоминание:</b> сегодня дежурного нет, никто не записался 😢';
  }

  message += getModersNotOnDutyMessage();

  return message;
};

const getSundayReminder = () => {
  const todayDuty = getByEndDate();
  let message;

  if (todayDuty) {
    const moderName = getModerName(todayDuty.name);
    message = `🔔 <b>Напоминание:</b> сегодня заканчивается твое дежурство, ${moderName}!\n`;
    message += `Пожалуйста, ознакомься с памяткой: ${rulesLink}\n`;
    message += '❗Не забудь записаться на новое дежурство с помощью команды: /assign';
  } else {
    message = '🔔 <b>Напоминание:</b> сегодня дежурного нет, завершать дежурство некому 😢\n';
    message += 'Записаться на новое дежурство: /assign';
  }

  return message;
};

const makeEverydayMaintenance = () => {
  createLog('Начинаем ежедневное обслуживание...');
  let message = '';

  if (isCircleStartDateToday()) {
    updateCircleStartDate();
    createLog('Дата начала нового круга обновлена');
  }

  if (isMondayToday()) {
    addCurrentDutyToHistory();
    removeFinishedDuties();
  }

  const birthdayModer = getModerWhoHasBirthdayToday();

  if (birthdayModer) {
    message += `🎉🎉🎉 Сегодня день рождения у @${birthdayModer.nickname}!\n\n`;
  }

  const todayHoliday = getTodayHoliday();

  if (todayHoliday) {
    message += `🎉🎉🎉 Сегодня на форуме праздник: <b>${todayHoliday.name}</b>!\n\n`;
  }

  const todayHolidayReminder = getTodayHolidayReminder();

  if (todayHolidayReminder) {
    message += `🔔 <b>Напоминание:</b>\n ${todayHolidayReminder.date} состоится важное событие: <b>${todayHolidayReminder.name}</b>! \n\n`;
  }

  createLog('✅ Ежедневное обслуживание произведено успешно!');
  return message;
};

module.exports = {
  getDuty,
  getMyDuty,
  getFormattedDutyList,
  getMondayReminder,
  getSundayReminder,
  getMiniModersList,
  getMoneyYears,
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
};
