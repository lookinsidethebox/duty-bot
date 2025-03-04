const {
  getCurrentDuty,
  getByStartDate,
  getByEndDate,
  getDutiesFormattedList,
  getModerName,
  getMiniModers,
} = require('./dutyService');
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

  Object.keys(dutiesByMonth).forEach((month) => {
    message += `\n<b>${month}:</b>\n`;
    const monthDuties = dutiesByMonth[month];

    for (let i = 0; i < monthDuties.length; i++) {
      const duty = monthDuties[i];
      const startDateStr = duty.startDate.format('DD.MM.YYYY');
      const endDateStr = duty.endDate.format('DD.MM.YYYY');

      message += `${startDateStr} — ${endDateStr}: ${duty.name}\n`;

      if (i < monthDuties.length - 1) {
        const nextDuty = monthDuties[i + 1];
        const gapInDays = nextDuty.startDate.diff(duty.endDate, 'days');

        if (gapInDays > 1) {
          let missingStart = duty.endDate.clone().add(1, 'day');

          while (missingStart.isBefore(nextDuty.startDate)) {
            let missingEndOfWeek = missingStart.clone().endOf('week');
            if (missingEndOfWeek.isAfter(nextDuty.startDate)) {
              missingEndOfWeek = nextDuty.startDate.clone().subtract(1, 'day');
            }

            if (missingStart.isBefore(missingEndOfWeek)) {
              message += `${missingStart.format(
                'DD.MM.YYYY'
              )} — ${missingEndOfWeek.format(
                'DD.MM.YYYY'
              )}: ❗<b>Дежурного нет</b>\n`;
            }

            missingStart = missingEndOfWeek.clone().add(1, 'day');
          }
        }
      }
    }
  });

  return message.trim();
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
    message = `🔔 Напоминание: с сегодняшнего дня дежурит ${moderName}!`;
  } else {
    message = '🔔 Напоминание: сегодня дежурного нет, никто не записался 😢';
  }

  return message;
};

const getSundayReminder = () => {
  const todayDuty = getByEndDate();
  let message;

  if (todayDuty) {
    const moderName = getModerName(todayDuty.name);
    message = `🔔 Напоминание: сегодня заканчивается твое дежурство, ${moderName}!\n`;
    message += `Пожалуйста, ознакомься с памяткой: ${rulesLink}`;
  } else {
    message =
      '🔔 Напоминание: сегодня дежурного нет, завершать дежурство некому 😢';
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
};
