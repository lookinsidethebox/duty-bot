const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const moment = require('moment');
require('moment/locale/ru');
moment.locale('ru');
const { getCircleStartDate, getCircleFinishDate } = require('./paramsService');
const { createLog, createReadError, createWriteError } = require('./logService');
const { filesFolderName, dutyFileName } = require('./config');

const DUTY_FILE_PATH = path.join(__dirname, '..', filesFolderName, dutyFileName);

const getDuties = () => {
  try {
    const data = fs.readFileSync(DUTY_FILE_PATH, 'utf-8');
    const duties = JSON.parse(data);
    duties.sort((a, b) => moment(a.startDate).diff(moment(b.startDate)));
    return duties;
  } catch (error) {
    createReadError(dutyFileName, error);
    return [];
  }
};

const getUserDuties = (name) => {
  try {
    const duties = getDuties().filter((duty) => duty.name === name);
    return duties.map((d) => ({
      startDate: d.startDate,
      label: `${moment(d.startDate).format('DD MMMM')} — ${moment(d.endDate).format('DD MMMM')}`,
    }));
  } catch (error) {
    return [];
  }
};

const getCurrentDuty = () => {
  try {
    const duties = getDuties();
    return duties.find((d) => moment().isBetween(d.startDate, d.endDate, null, '[]'));
  } catch (error) {
    return [];
  }
};

const getByStartDate = () => {
  try {
    const duties = getDuties();
    const today = moment().format('YYYY-MM-DD');
    return duties.find((duty) => duty.startDate === today);
  } catch (error) {
    return [];
  }
};

const getByEndDate = () => {
  try {
    const duties = getDuties();
    const today = moment().format('YYYY-MM-DD');
    return duties.find((duty) => duty.endDate === today);
  } catch (error) {
    return [];
  }
};

const getDutiesFormattedList = () => {
  const duties = getDuties();

  if (duties.length === 0) {
    return null;
  }

  const dutiesByMonth = {};
  let lastDutyEndDate = null;

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

    if (!lastDutyEndDate || endDate.isAfter(lastDutyEndDate)) {
      lastDutyEndDate = endDate;
    }
  });

  Object.keys(dutiesByMonth).forEach((month) => {
    dutiesByMonth[month].sort((a, b) => a.startDate - b.startDate);
  });

  const circleFinishDate = getCircleFinishDate();

  if (lastDutyEndDate.isBefore(circleFinishDate)) {
    let nextDate = lastDutyEndDate.clone().add(1, 'day');

    while (nextDate.isBefore(circleFinishDate)) {
      const startDate = nextDate.clone();
      const endDate = nextDate.clone().add(6, 'day');
      const monthYear = startDate.format('MMMM YYYY');

      if (!dutiesByMonth[monthYear]) {
        dutiesByMonth[monthYear] = [];
      }

      dutiesByMonth[monthYear].push({
        startDate: startDate,
        endDate: endDate,
        name: '❗<b>Дежурного нет</b>',
      });

      nextDate = nextDate.add(7, 'day');
    }
  }

  return dutiesByMonth;
};

const isCurrentUserHasDutyThisCircle = (duties, circleStartDate, circleFinishDate) => {
  return duties.some((duty) => {
    const dutyStartDate = moment(duty.startDate);
    return dutyStartDate.isBetween(circleStartDate, circleFinishDate, 'day', '[]');
  });
};

const isCurrentUserHasDutyAfterThisCircle = (duties, circleFinishDate) => {
  return duties.some((duty) => {
    const dutyStartDate = moment(duty.startDate);
    return dutyStartDate.isAfter(circleFinishDate, 'day');
  });
};

const getAvailableSlots = (name) => {
  const userDuties = getUserDuties(name);
  const duties = getDuties();
  const today = moment();
  const slots = [];
  let lastDutyEndDate;

  if (duties.length === 0) {
    lastDutyEndDate = today.clone().endOf('week').add(1, 'day');
  } else {
    lastDutyEndDate = moment(duties[duties.length - 1].endDate).add(1, 'day');
  }

  const circleStartDate = getCircleStartDate();
  const circleFinishDate = getCircleFinishDate();
  const hasDuties = isCurrentUserHasDutyThisCircle(userDuties, circleStartDate, circleFinishDate);

  if (hasDuties) {
    const hasAllDuties = isCurrentUserHasDutyAfterThisCircle(userDuties, circleFinishDate);

    if (hasAllDuties) {
      return '⛔ Ты уже записан на дежурство. Дождись начала нового круга.';
    }

    lastDutyEndDate = circleFinishDate.clone();

    for (let i = 0; i < 4; i++) {
      const nextSlotStartDate = lastDutyEndDate.clone();
      const nextSlotEndDate = nextSlotStartDate.clone().add(6, 'days');

      slots.push({
        startDate: nextSlotStartDate.format('DD MMMM'),
        endDate: nextSlotEndDate.format('DD MMMM'),
      });

      lastDutyEndDate.add(7, 'days');
    }

    return slots;
  }

  for (let i = 0; i < duties.length - 1 && slots.length < 4; i++) {
    const currentDutyEnd = moment(duties[i].endDate);
    const nextDutyStart = moment(duties[i + 1].startDate);
    let gapStart = currentDutyEnd.clone().add(1, 'day');

    while (gapStart.isBefore(nextDutyStart) && slots.length < 4) {
      const slotStartDate = gapStart.clone().startOf('week');
      const slotEndDate = slotStartDate.clone().endOf('week');

      if (slotStartDate.isBefore(nextDutyStart)) {
        slots.push({
          startDate: slotStartDate.format('DD MMMM'),
          endDate: slotEndDate.format('DD MMMM'),
        });
      }

      gapStart = slotEndDate.clone().add(1, 'day');
    }
  }

  while (lastDutyEndDate < circleFinishDate) {
    const nextSlotStartDate = lastDutyEndDate.clone();
    const nextSlotEndDate = nextSlotStartDate.clone().add(6, 'days');

    slots.push({
      startDate: nextSlotStartDate.format('DD MMMM'),
      endDate: nextSlotEndDate.format('DD MMMM'),
    });

    lastDutyEndDate.add(7, 'days');
  }

  return slots;
};

const createDuty = async (moderName, selectedDate) => {
  const duties = getDuties();
  const formattedStartDate = moment(selectedDate, 'DD MMMM', 'ru');
  const endDate = formattedStartDate.clone().add(6, 'days').format('YYYY-MM-DD');

  const newDuty = {
    startDate: formattedStartDate.format('YYYY-MM-DD'),
    endDate: endDate,
    name: moderName,
  };

  duties.push(newDuty);
  duties.sort((a, b) => moment(a.startDate).diff(moment(b.startDate)));

  try {
    await fsp.writeFile(DUTY_FILE_PATH, JSON.stringify(duties, null, 2));
  } catch (error) {
    createWriteError(dutyFileName, error);
  }
};

const removeDuty = async (duty) => {
  const duties = getDuties();
  const activeDuties = duties.filter((d) => d.startDate !== duty.startDate);

  if (activeDuties.length !== duties.length) {
    try {
      fs.writeFileSync(DUTY_FILE_PATH, JSON.stringify(activeDuties, null, 2), 'utf-8');
    } catch (error) {
      createWriteError(dutyFileName, error);
    }
  }
};

const removeFinishedDuty = () => {
  const duties = getDuties();
  const today = moment().startOf('day');
  const activeDuties = duties.filter((duty) => !moment(duty.endDate).isBefore(today));
  let removedCount = duties.length - activeDuties.length;

  if (activeDuties.length !== duties.length) {
    try {
      fs.writeFileSync(DUTY_FILE_PATH, JSON.stringify(activeDuties, null, 2), 'utf-8');
      createLog(`Количество удаленных старых дежурств: ${removedCount}.`);
    } catch (error) {
      createWriteError(dutyFileName, error);
    }
  } else {
    createLog('Старых дежурств для удаления не найдено.');
  }
};

module.exports = {
  getDuties,
  getCurrentDuty,
  getByStartDate,
  getByEndDate,
  getDutiesFormattedList,
  createDuty,
  removeDuty,
  removeFinishedDuty,
  getAvailableSlots,
  getUserDuties,
};
