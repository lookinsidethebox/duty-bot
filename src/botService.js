const {
  getCurrentDuty,
  getByStartDate,
  getByEndDate,
  getDutiesFormattedList,
} = require('./dutyService');
const { rulesLink } = require('./config');

const getDuty = () => {
  const currentDuty = getCurrentDuty();

  if (currentDuty) {
    const nickname = currentDuty.nickname ? ` (@${currentDuty.nickname})` : '';
    return `<b>Дежурный</b>: ${currentDuty.name}${nickname}`;
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

const getMondayReminder = () => {
  const todayDuty = getByStartDate();
  let message;

  if (todayDuty) {
    const nickname = todayDuty.nickname ? ` (@${todayDuty.nickname})` : '';
    message = `🔔 Напоминание: с сегодняшнего дня дежурит ${todayDuty.name}${nickname}!`;
  } else {
    message = '🔔 Напоминание: сегодня дежурного нет, никто не записался 😢';
  }

  return message;
};

const getSundayReminder = () => {
  const todayDuty = getByEndDate();
  let message;

  if (todayDuty) {
    const nickname = todayDuty.nickname ? ` (@${todayDuty.nickname})` : '';
    message = `🔔 Напоминание: сегодня заканчивается твое дежурство, ${todayDuty.name}${nickname}!\nПожалуйста, ознакомься с памяткой: ${rulesLink}`;
  } else {
    message =
      '🔔 Напоминание: сегодня дежурного нет, завершать дежурство некому 😢';
  }

  return message;
};

module.exports = {
  getDuty,
  getFormattedDutyList,
  getMondayReminder,
  getSundayReminder,
};
