const moment = require('moment');
const { getDuties } = require('./dutyService');
const { rulesLink } = require('./config');

const getCurrentDuty = () => {
  const duties = getDuties();
  const today = moment().format('YYYY-MM-DD');

  const currentDuty = duties.find((d) =>
    moment(today).isBetween(d.startDate, d.endDate, null, '[]')
  );

  if (currentDuty) {
    const nickname = currentDuty.nickname ? ` (@${currentDuty.nickname})` : '';
    return `<b>Дежурный</b>: ${currentDuty.name}${nickname}`;
  } else {
    return 'Дежурного нет, никто не записался 😢';
  }
};

const getFormattedDutyList = () => {
  const duties = getDuties();

  if (duties.length === 0) {
    return 'График дежурств пуст 😢';
  }

  let message = '📋 <b>График дежурств:</b>\n';
  const dutiesByMonth = {};

  duties.forEach((duty) => {
    const startDate = moment(duty.startDate);
    const endDate = moment(duty.endDate);
    const monthYear = startDate.format('MMMM YYYY');

    if (!dutiesByMonth[monthYear]) {
      dutiesByMonth[monthYear] = [];
    }

    dutiesByMonth[monthYear].push({
      startDate: startDate,
      endDate: endDate,
      name: duty.name,
    });
  });

  Object.keys(dutiesByMonth).forEach((month) => {
    dutiesByMonth[month].sort((a, b) => a.startDate - b.startDate);
  });

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
  const today = moment().format('YYYY-MM-DD');
  const duties = getDuties();
  const todayDuty = duties.find((duty) => duty.startDate === today);

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
  const today = moment().format('YYYY-MM-DD');
  const duties = getDuties();
  const todayDuty = duties.find((duty) => duty.startDate === today);

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
  getCurrentDuty,
  getFormattedDutyList,
  getMondayReminder,
  getSundayReminder,
};
