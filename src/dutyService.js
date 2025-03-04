const fs = require('fs');
const path = require('path');
const moment = require('moment');

const dutyFilePath = path.join(__dirname, 'duty.json');
const usersFilePath = path.join(__dirname, '.users.json');

const getDuties = () => {
  try {
    const data = fs.readFileSync(dutyFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Ошибка чтения duty.json:', error);
    return [];
  }
};

const getUsers = () => {
  try {
    const data = fs.readFileSync(usersFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Ошибка чтения .users.json:', error);
    return [];
  }
};

const getUserName = (name) => {
  const users = getUsers();
  const user = users.find((user) => user.name === name);
  return user ? `${name} (@${user.nickname})` : `${name}`;
};

const getCurrentDuty = () => {
  try {
    const duties = getDuties();
    const today = moment().format('YYYY-MM-DD');
    return duties.find((d) =>
      moment(today).isBetween(d.startDate, d.endDate, null, '[]')
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

const addDuty = (duty) => {
  const duties = getDuties();
  duties.push(duty);
  fs.writeFileSync(dutyFilePath, JSON.stringify(duties, null, 2));
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
  addDuty,
  removeFinishedDuty,
  getUserName,
};
