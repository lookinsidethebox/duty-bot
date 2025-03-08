const fs = require('fs');
const path = require('path');
const moment = require('moment');
require('moment/locale/ru');
moment.locale('ru');
const { createLog, createReadError, createWriteError } = require('./logService');
const { getDuties } = require('./dutyService');
const { filesFolderName, historyFileName } = require('./config');

const HISTORY_FILE_PATH = path.join(__dirname, '..', filesFolderName, historyFileName);

const getHistory = () => {
  try {
    const data = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    createReadError(historyFileName, error);
  }
};

const addCurrentDutyToHistory = () => {
  const duties = getDuties();
  const yesterday = moment().subtract(1, 'day');
  const lastDuty = duties.find((duty) => moment(duty.endDate).isSame(yesterday, 'day'));

  if (lastDuty) {
    try {
      const history = getHistory();
      const startYear = moment(lastDuty.startDate).format('YYYY');

      if (!history[startYear]) {
        history[startYear] = [];
      }

      history[startYear].push(lastDuty);
      fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
      createLog('✅ Предыдущее дежурство успешно сохранено в историю!');
    } catch (error) {
      createWriteError(historyFileName, error);
    }
  } else {
    createLog('Не удалось найти предыдущее дежурство.');
  }
};

const getYearsList = () => {
  const history = getHistory();
  return Object.keys(history);
};

const getHistoryByYear = (year) => {
  const history = getHistory();
  return history[year].map((item) => ({
    name: item.name,
    startDate: moment(item.startDate).format('DD MMMM'),
    endDate: moment(item.endDate).format('DD MMMM'),
  }));
};

module.exports = { addCurrentDutyToHistory, getYearsList, getHistoryByYear };
