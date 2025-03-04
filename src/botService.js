const {
  getCurrentDuty,
  getByStartDate,
  getByEndDate,
  getDutiesFormattedList,
  getAvailableSlots,
  createDuty,
} = require('./dutyService');
const {
  getModerName,
  getMiniModers,
  getModersNotOnDuty,
  getModerByUsername,
} = require('./userService');
const {
  rulesLink,
  moneyLink,
  tinkoffCard,
  hipotekarnaCard,
} = require('./config');

const getDuty = () => {
  const currentDuty = getCurrentDuty();

  if (currentDuty) {
    const moderName = getModerName(currentDuty.name);
    return `<b>Дежурный</b>: ${moderName}`;
  } else {
    return 'Дежурного нет, никто не записался 😢';
  }
};

const getFormattedDutyList = () => {
  const dutiesByMonth = getDutiesFormattedList();

  if (!dutiesByMonth) {
    return 'График дежурств пуст 😢';
  }

  let message = '📋 <b>График дежурств:</b>\n';
  let previousDutyEndDate = null;
  let currentMonth = '';

  Object.keys(dutiesByMonth).forEach((month) => {
    const monthDuties = dutiesByMonth[month];

    monthDuties.forEach((duty) => {
      const startDateStr = duty.startDate.format('DD MMMM');
      const endDateStr = duty.endDate.format('DD MMMM');
      const dutyMonth = duty.startDate.format('MMMM YYYY');

      if (previousDutyEndDate) {
        const gapInDays = duty.startDate.diff(previousDutyEndDate, 'days');

        if (gapInDays > 1) {
          let missingStart = previousDutyEndDate.clone().add(1, 'day');

          while (missingStart.isBefore(duty.startDate)) {
            let missingEnd = missingStart.clone().add(6, 'day');
            const missingMonth = missingStart.format('MMMM YYYY');

            if (missingMonth !== currentMonth) {
              message += `\n<b>${missingMonth}:</b>\n`;
              currentMonth = missingMonth;
            }

            message += `${missingStart.format('DD MMMM')} — ${missingEnd.format(
              'DD MMMM'
            )}: ❗<b>Дежурного нет</b>\n`;
            missingStart = missingEnd.clone().add(1, 'day');
          }
        }
      }

      if (dutyMonth !== currentMonth) {
        const capitalizedMonthYear =
          dutyMonth.charAt(0).toUpperCase() + dutyMonth.slice(1);
        message += `\n<b>${capitalizedMonthYear}:</b>\n`;
        currentMonth = dutyMonth;
      }

      message += `${startDateStr} — ${endDateStr}: ${duty.name}\n`;
      previousDutyEndDate = duty.endDate.clone();
    });
  });

  const modersNotOnDuty = getModersNotOnDuty();

  if (modersNotOnDuty.length > 0) {
    message += `\n\n❗<b>Модераторы, не записавшиеся на дежурство:</b>\n`;
    modersNotOnDuty.forEach((moder) => {
      message += `${getModerName(moder.name)}\n`;
    });
    message += 'Записаться на новое дежурство: /assign';
  }

  return message.trim();
};

const getNextDutySlots = () => {
  return getAvailableSlots().map((slot) => ({
    startDate: slot.startDate,
    endDate: slot.endDate,
    label: `${slot.startDate} — ${slot.endDate}`,
  }));
};

const assignDuty = async (username, selectedDate) => {
  const moder = getModerByUsername(username);

  if (!moder) {
    return '⛔ Извини, я не нашел тебя в списке модераторов. Запись не добавлена.';
  }

  await createDuty(moder.name, selectedDate);
  return `✅ Запись успешно добавлена! Твое дежурство будет начинаться с ${selectedDate}.`;
};

const getMiniModersList = () => {
  const miniModers = getMiniModers();

  if (miniModers.length === 0) {
    return 'Минимодераторов нет 😢';
  }

  let message = '📋 <b>Список минимодеров:</b>\n';
  miniModers.forEach((moder) => {
    message += `<b>${moder.name}</b> (@${moder.nickname}): ${moder.topics}\n`;
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
    message =
      '🔔 <b>Напоминание:</b> сегодня дежурного нет, никто не записался 😢';
  }

  return message;
};

const getSundayReminder = () => {
  const todayDuty = getByEndDate();
  let message;

  if (todayDuty) {
    const moderName = getModerName(todayDuty.name);
    message = `🔔 <b>Напоминание:</b> сегодня заканчивается твое дежурство, ${moderName}!\n`;
    message += `Пожалуйста, ознакомься с памяткой: ${rulesLink}\n`;
    message +=
      '❗Не забудь записаться на новое дежурство с помощью команды: /assign';
  } else {
    message =
      '🔔 <b>Напоминание:</b> сегодня дежурного нет, завершать дежурство некому 😢\n';
    message += 'Записаться на новое дежурство: /assign';
  }

  return message;
};

const getMoneyInfo = () => {
  let message = `📋 <b>Отчет по оплате за хостинг:</b>\n ${moneyLink}\n\n`;
  message += '<b>Реквизиты для перевода:</b>\n';
  message += `Карта Тинькофф: ${tinkoffCard}\n`;
  message += `Карта иностранного банка: ${hipotekarnaCard} (можно слать через PaySend)`;
  return message;
};

module.exports = {
  getDuty,
  getFormattedDutyList,
  getMondayReminder,
  getSundayReminder,
  getMiniModersList,
  getMoneyInfo,
  getNextDutySlots,
  assignDuty,
};
