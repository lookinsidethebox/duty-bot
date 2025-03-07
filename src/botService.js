const { rulesLink, moneyLink, tinkoffCard, hipotekarnaCard } = require('./config');
const { createLog } = require('./logService');
const {
  getCurrentDuty,
  getByStartDate,
  getByEndDate,
  getDutiesFormattedList,
  getAvailableSlots,
  createDuty,
  getUserDuties,
  removeDuty,
} = require('./dutyService');
const {
  getModerName,
  getMiniModers,
  getModersNotOnDuty,
  getModerByUsername,
} = require('./userService');
const {
  getCircleStartDate,
  getCircleFinishDate,
  isCircleStartDateToday,
  updateCircleStartDate,
} = require('./paramsService');

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
              'DD MMMM'
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

  const modersNotOnDuty = getModersNotOnDuty();

  if (modersNotOnDuty.length > 0) {
    message += `\n❗<b>Модеры, не записавшиеся на дежурство:</b>\n`;
    modersNotOnDuty.forEach((moder) => {
      message += `${getModerName(moder.name)}`;
    });
  }

  message += '\nЗаписаться на новое дежурство: /assign';
  return message.trim();
};

const getCapitalizedMonth = (month) => {
  return month.charAt(0).toUpperCase() + month.slice(1);
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
  return `✅ Запись успешно добавлена! Твое дежурство будет начинаться с ${selectedDate}.`;
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
  return `✅ Дежурство успешно удалено! Не забудь записаться на новое: /assign`;
};

const getMiniModersList = () => {
  const miniModers = getMiniModers();

  if (miniModers.length === 0) {
    return 'Минимодеров нет 😢';
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
    message = '🔔 <b>Напоминание:</b> сегодня дежурного нет, никто не записался 😢';
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
    message += '❗Не забудь записаться на новое дежурство с помощью команды: /assign';
  } else {
    message = '🔔 <b>Напоминание:</b> сегодня дежурного нет, завершать дежурство некому 😢\n';
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

const makeEverydayMaintenance = () => {
  createLog('Начинаем ежедневное обслуживание...');

  if (isCircleStartDateToday()) {
    updateCircleStartDate();
    createLog('Дата начала нового круга обновлена');
  }

  createLog('✅ Ежедневное обслуживание произведено успешно!');
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
  getDutiesToRemove,
  removeUserDuty,
  makeEverydayMaintenance,
};
