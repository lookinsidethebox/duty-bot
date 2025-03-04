const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const moment = require('moment');
require('moment/locale/ru');
moment.locale('ru');

const dutyFilePath = path.join(__dirname, 'duty.json');

const getDuties = () => {
  try {
    const data = fs.readFileSync(dutyFilePath, 'utf-8');
    const duties = JSON.parse(data);
    duties.sort((a, b) => moment(a.startDate).diff(moment(b.startDate)));
    return duties;
  } catch (error) {
    console.error('Ошибка чтения duty.json:', error);
    return [];
  }
};

const getCurrentDuty = () => {
  try {
    const duties = getDuties();
    return duties.find((d) =>
      moment().isBetween(d.startDate, d.endDate, null, '[]')
    );
  } catch (error) {
    console.error('Ошибка чтения duty.json:', error);
    return [];
  }
};

const getByStartDate = () => {
  try {
    const duties = getDuties();
    const today = moment().format('YYYY-MM-DD');
    return duties.find((duty) => duty.startDate === today);
  } catch (error) {
    console.error('Ошибка чтения duty.json:', error);
    return [];
  }
};

const getByEndDate = () => {
  try {
    const duties = getDuties();
    const today = moment().format('YYYY-MM-DD');
    return duties.find((duty) => duty.endDate === today);
  } catch (error) {
    console.error('Ошибка чтения duty.json:', error);
    return [];
  }
};

const getDutiesFormattedList = () => {
  const duties = getDuties();

  if (duties.length === 0) {
    return null;
  }

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

  return dutiesByMonth;
};

const getAvailableSlots = () => {
  const duties = getDuties();
  const today = moment();
  const slots = [];
  let lastDutyEndDate;

  if (duties.length === 0) {
    lastDutyEndDate = today.clone().endOf('week').add(1, 'day');
  } else {
    lastDutyEndDate = moment(duties[duties.length - 1].endDate).add(1, 'day');
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

  while (slots.length < 4) {
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
  const endDate = formattedStartDate
    .clone()
    .add(6, 'days')
    .format('YYYY-MM-DD');

  const newDuty = {
    startDate: formattedStartDate.format('YYYY-MM-DD'),
    endDate: endDate,
    name: moderName,
  };

  duties.push(newDuty);
  duties.sort((a, b) => moment(a.startDate).diff(moment(b.startDate)));

  try {
    await fsp.writeFile(dutyFilePath, JSON.stringify(duties, null, 2));
  } catch (error) {
    console.error('Ошибка записи в duty.json:', error);
  }
};

const removeFinishedDuty = () => {
  const duties = getDuties();
  const today = moment().startOf('day');
  const currentDuties = duties.filter(
    (duty) => !moment(duty.endDate).isBefore(today)
  );
  let removedCount = duties.length - currentDuties.length;

  if (currentDuties.length !== duties.length) {
    try {
      fs.writeFileSync(
        dutyFilePath,
        JSON.stringify(currentDuties, null, 2),
        'utf-8'
      );
      console.log(`Количество удаленных старых дежурств: ${removedCount}.`);
    } catch (error) {
      console.error('Ошибка записи в duty.json:', error);
    }
  } else {
    console.log('Старых дежурств для удаления не найдено.');
  }
};

module.exports = {
  getDuties,
  getCurrentDuty,
  getByStartDate,
  getByEndDate,
  getDutiesFormattedList,
  createDuty,
  removeFinishedDuty,
  getAvailableSlots,
};
