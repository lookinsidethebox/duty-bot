const fs = require('fs');
const path = require('path');
const moment = require('moment');
require('moment/locale/ru');
moment.locale('ru');
const { createLog, createReadError } = require('./logService');
const { filesFolderName, holidaysFileName } = require('./config');

const HOLIDAYS_FILE_PATH = path.join(__dirname, '..', filesFolderName, holidaysFileName);

const getHolidays = () => {
  try {
    const data = fs.readFileSync(HOLIDAYS_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    createReadError(historyFileName, error);
  }
};

const getHolidaysFormatted = () => {
  const holidays = getHolidays();
  return holidays.map((holiday) => ({
    name: holiday.name,
    date: `${moment(holiday.date).format('DD MMMM')}`,
  }));
};

const getTodayHoliday = () => {
  const holidays = getHolidays();
  const currentDate = moment().format('MM-DD');
  const holiday = holidays.find((holiday) => holiday.date === currentDate);

  if (!holiday) {
    return null;
  }

  return { name: holiday.name };
};

const getTodayHolidayReminder = () => {
  const holidays = getHolidays();
  const currentDate = moment().format('MM-DD');
  const holiday = holidays.find((holiday) => holiday.firstNotificationDate === currentDate);

  if (!holiday) {
    return null;
  }

  return {
    name: holiday.name,
    date: `${moment(holiday.date).format('DD MMMM')}`,
  };
};

module.exports = { getHolidaysFormatted, getTodayHoliday, getTodayHolidayReminder };
