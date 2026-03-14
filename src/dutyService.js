const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const moment = require('moment');
require('moment/locale/ru');
moment.locale('ru');
const { getCircleStartDate, getCircleFinishDate } = require('./paramsService');
const { createLog, createReadError, createWriteError } = require('./logService');
const { filesFolderName, dutyFileName, historyFileName } = require('./config');

const DUTY_FILE_PATH = path.join(__dirname, '..', filesFolderName, dutyFileName);
const HISTORY_FILE_PATH = path.join(__dirname, '..', filesFolderName, historyFileName);

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

const getHistoryDuties = () => {
  try {
    const data = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8');
    const history = JSON.parse(data);
    return Object.values(history).flat();
  } catch (error) {
    createReadError(historyFileName, error);
    return [];
  }
};

const getUserDuties = (name) => {
  try {
    const duties = getDuties().filter((duty) => duty.name === name);
    return duties.map((d) => ({
      startDate: d.startDate,
      label: `${moment(d.startDate).format('DD MMMM YYYY')} — ${moment(d.endDate).format(
        'DD MMMM YYYY'
      )}`,
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
    return dutyStartDate.isSameOrAfter(circleStartDate, 'day') && dutyStartDate.isBefore(circleFinishDate, 'day');
  });
};

const getAvailableSlotsInCircle = (duties, circleStartDate, circleFinishDate) => {
  const today = moment().startOf('day');
  const slots = [];

  for (
    let slotStartDate = circleStartDate.clone();
    slotStartDate.isBefore(circleFinishDate) && slots.length < 4;
    slotStartDate.add(1, 'week')
  ) {
    const slotEndDate = slotStartDate.clone().add(6, 'days');

    if (slotEndDate.isBefore(today, 'day')) {
      continue;
    }

    const isSlotTaken = duties.some((duty) => {
      const dutyStartDate = moment(duty.startDate);
      const dutyEndDate = moment(duty.endDate);

      return (
        dutyStartDate.isSameOrBefore(slotEndDate, 'day') &&
        dutyEndDate.isSameOrAfter(slotStartDate, 'day')
      );
    });

    if (!isSlotTaken) {
      slots.push({
        startDate: slotStartDate.format('DD MMMM YYYY'),
        endDate: slotEndDate.format('DD MMMM YYYY'),
      });
    }
  }

  return slots;
};

const getAvailableSlots = (name) => {
  const activeDuties = getDuties();
  const historyDuties = getHistoryDuties();
  const nextCircleStartDate = getCircleStartDate().startOf('day');
  const nextCircleFinishDate = getCircleFinishDate().startOf('day');
  const circleDurationInWeeks = nextCircleFinishDate.diff(nextCircleStartDate, 'weeks');
  const currentCircleStartDate = nextCircleStartDate.clone().subtract(circleDurationInWeeks, 'weeks');
  const userDuties = [...historyDuties, ...activeDuties].filter((duty) => duty.name === name);
  const hasDutyThisCircle = isCurrentUserHasDutyThisCircle(
    userDuties,
    currentCircleStartDate,
    nextCircleStartDate
  );
  const hasDutyNextCircle = isCurrentUserHasDutyThisCircle(
    userDuties,
    nextCircleStartDate,
    nextCircleFinishDate
  );

  if (hasDutyThisCircle && hasDutyNextCircle) {
    return '⛔ Ты уже записан на дежурство. Дождись начала нового круга.';
  }

  if (!hasDutyThisCircle) {
    return getAvailableSlotsInCircle(
      [...historyDuties, ...activeDuties],
      currentCircleStartDate,
      nextCircleStartDate
    );
  }

  return getAvailableSlotsInCircle(activeDuties, nextCircleStartDate, nextCircleFinishDate);
};

const createDuty = async (moderName, selectedDate) => {
  const duties = getDuties();
  const formattedStartDate = moment(selectedDate, 'DD MMMM YYYY', 'ru');
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

const removeFinishedDuties = () => {
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
  removeFinishedDuties,
  getAvailableSlots,
  getUserDuties,
};
