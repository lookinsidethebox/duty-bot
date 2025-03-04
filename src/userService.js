const fs = require('fs');
const path = require('path');
const { getDuties } = require('./dutyService');

const modersFilePath = path.join(__dirname, '.moders.json');
const miniModersFilePath = path.join(__dirname, '.mini-moders.json');

const getModers = () => {
  try {
    const data = fs.readFileSync(modersFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Ошибка чтения .moders.json:', error);
    return [];
  }
};

const getModersNotOnDuty = () => {
  const allModers = getModers();
  const duties = getDuties();
  const modersOnDutyNames = new Set(duties.map((duty) => duty.name));
  const modersNotOnDuty = allModers.filter(
    (moder) => !modersOnDutyNames.has(moder.name)
  );
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
    console.error('Ошибка чтения .mini-moders.json:', error);
    return [];
  }
};

const getModerByUsername = (username) => {
  const moders = getModers();
  return moders.find((user) => user.nickname === username);
};

module.exports = {
  getModerName,
  getMiniModers,
  getModersNotOnDuty,
  getModerByUsername,
};
