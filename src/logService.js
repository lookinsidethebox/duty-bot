const moment = require('moment');

const createLog = (message) => {
  console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${message}`);
};

const createReadError = (fileName, error) => {
  console.error(
    `[${moment().format('YYYY-MM-DD HH:mm:ss')}] Ошибка записи в ${fileName}: ${error}`
  );
};

const createWriteError = (fileName, error) => {
  console.error(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] Ошибка чтения ${fileName}: ${error}`);
};

module.exports = { createLog, createReadError, createWriteError };
