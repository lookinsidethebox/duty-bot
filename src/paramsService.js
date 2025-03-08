const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const moment = require('moment');
require('moment/locale/ru');
moment.locale('ru');
const { createReadError, createWriteError } = require('./logService');
const { filesFolderName, modersFileName, paramsFileName } = require('./config');

const paramsFilePath = path.join(__dirname, '..', filesFolderName, paramsFileName);
const modersFilePath = path.join(__dirname, '..', filesFolderName, modersFileName);

const getParams = () => {
  try {
    const data = fs.readFileSync(paramsFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    createReadError(paramsFileName, error);
    return [];
  }
};

const getCircleStartDate = () => {
  try {
    const params = getParams();
    return moment(params.circleStartDate);
  } catch (error) {
    return [];
  }
};

const getCircleFinishDate = () => {
  try {
    const startDate = getCircleStartDate();
    const modersCount = getModersCount();
    return startDate.add(modersCount, 'weeks');
  } catch (error) {
    return [];
  }
};

const isCircleStartDateToday = () => {
  try {
    const startDate = getCircleStartDate();
    const today = moment();
    return startDate.isSame(today, 'day');
  } catch (error) {
    return false;
  }
};

const updateCircleStartDate = () => {
  try {
    const params = getParams();
    const modersCount = getModersCount();
    params.circleStartDate = moment(params.circleStartDate)
      .add(modersCount, 'weeks')
      .format('YYYY-MM-DD');
    fs.writeFileSync(paramsFilePath, JSON.stringify(params, null, 2), 'utf-8');
  } catch (error) {
    createWriteError(paramsFileName, error);
  }
};

const setCircleStartDateManually = async (date) => {
  try {
    const params = getParams();
    params.circleStartDate = date;
    await fsp.writeFile(paramsFilePath, JSON.stringify(params, null, 2));
  } catch (error) {
    createWriteError(paramsFileName, error);
  }
};

const getModersCount = () => {
  try {
    const data = fs.readFileSync(modersFilePath, 'utf-8');
    const moders = JSON.parse(data);
    return moders.length;
  } catch (error) {
    createReadError(modersFileName, error);
    return [];
  }
};

const isTodayMonday = async () => {
  return moment().day() === 1;
};

module.exports = {
  getCircleStartDate,
  getCircleFinishDate,
  isCircleStartDateToday,
  updateCircleStartDate,
  setCircleStartDateManually,
  isTodayMonday,
};
