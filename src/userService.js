const fs = require('fs');
const path = require('path');
const moment = require('moment');
require('moment/locale/ru');
moment.locale('ru');
const { getDuties } = require('./dutyService');
const { createReadError } = require('./logService');
const { filesFolderName, modersFileName, miniModersFileName } = require('./config');

const modersFilePath = path.join(__dirname, '..', filesFolderName, modersFileName);
const miniModersFilePath = path.join(__dirname, '..', filesFolderName, miniModersFileName);

const getModers = () => {
  try {
    const data = fs.readFileSync(modersFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    createReadError(modersFileName, error);
    return [];
  }
};

const getModersNotOnDuty = () => {
  const allModers = getModers();
  const duties = getDuties();
  const modersOnDutyNames = new Set(duties.map((duty) => duty.name));
  const modersNotOnDuty = allModers.filter((moder) => !modersOnDutyNames.has(moder.name));
  return modersNotOnDuty;
};

const getModerName = (name) => {
  const moders = getModers();
  const moder = moders.find((user) => user.name === name);
  return moder ? `${name} (@${moder.nickname})` : `${name}`;
};

const getMiniModers = () => {
  try {
    const data = fs.readFileSync(miniModersFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    createReadError(miniModersFileName, error);
    return [];
  }
};

const getModerByUsername = (username) => {
  if (!username) {
    return null;
  }

  const moders = getModers();
  return moders.find((user) => user.nickname === username);
};

const getModerWhoHasBirthdayToday = () => {
  const moders = getModers();
  const currentDate = moment().format('MM-DD');
  return moders.find((moder) => moder.birthday === currentDate);
};

module.exports = {
  getModerName,
  getMiniModers,
  getModersNotOnDuty,
  getModerByUsername,
  getModerWhoHasBirthdayToday,
};
