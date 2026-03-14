const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const moment = require('moment');
require('moment/locale/ru');
moment.locale('ru');
const { createReadError, createWriteError } = require('./logService');
const { filesFolderName, moneyFileName } = require('./config');

const MONEY_FILE_PATH = path.join(__dirname, '..', filesFolderName, moneyFileName);

const getMoneyEntries = () => {
  try {
    const data = fs.readFileSync(MONEY_FILE_PATH, 'utf-8');
    const entries = JSON.parse(data);
    entries.sort((a, b) => moment(a.date).diff(moment(b.date)));
    return entries;
  } catch (error) {
    createReadError(moneyFileName, error);
    return [];
  }
};

const getMoneyYearsList = () => {
  const entries = getMoneyEntries();
  return [...new Set(entries.map((entry) => moment(entry.date).format('YYYY')))];
};

const getMoneyHistoryByYear = (year) => {
  const entries = getMoneyEntries().filter((entry) => moment(entry.date).format('YYYY') === year);

  return entries.map((entry) => ({
    date: moment(entry.date).format('DD MMMM'),
    description: entry.description,
    incomeEur: entry.income_eur,
    incomeRub: entry.income_rub,
    outcome: entry.outcome,
    balance: entry.balance,
  }));
};

const getMoneyHistoryForLastMonths = (monthsCount = 3) => {
  const startDate = moment().subtract(monthsCount, 'months').startOf('day');
  const entries = getMoneyEntries().filter((entry) => moment(entry.date).isSameOrAfter(startDate, 'day'));

  return entries.map((entry) => ({
    date: moment(entry.date).format('DD MMMM'),
    description: entry.description,
    incomeEur: entry.income_eur,
    incomeRub: entry.income_rub,
    outcome: entry.outcome,
    balance: entry.balance,
  }));
};

const parseOutcomeValue = (outcome) => {
  if (outcome === null || outcome === undefined) {
    return 0;
  }

  if (typeof outcome === 'number') {
    return outcome;
  }

  if (typeof outcome === 'string') {
    const matchInBrackets = outcome.match(/\(([\d.]+)\)/);

    if (matchInBrackets) {
      return Number(matchInBrackets[1]);
    }

    const numericMatch = outcome.match(/[\d.]+/);

    if (numericMatch) {
      return Number(numericMatch[0]);
    }
  }

  return 0;
};

const roundToTwo = (value) => {
  return Math.round(value * 100) / 100;
};

const recalculateBalancesFromIndex = (entries, startIndex) => {
  const updatedEntries = entries.map((entry) => ({ ...entry }));
  let balance = startIndex > 0 ? Number(updatedEntries[startIndex - 1].balance) || 0 : 0;

  for (let index = startIndex; index < updatedEntries.length; index++) {
    const entry = updatedEntries[index];
    const incomeEur = Number(entry.income_eur) || 0;
    const outcome = parseOutcomeValue(entry.outcome);
    balance = roundToTwo(balance + incomeEur - outcome);
    updatedEntries[index].balance = balance;
  }

  return updatedEntries;
};

const addMoneyEntry = async ({ date, description, incomeEur = null, incomeRub = null, outcome = null }) => {
  const entries = getMoneyEntries();
  const newEntry = {
    date,
    description,
    income_eur: incomeEur,
    income_rub: incomeRub,
    outcome,
    balance: 0,
  };

  entries.push(newEntry);
  entries.sort((a, b) => moment(a.date).diff(moment(b.date)));

  try {
    const insertedEntryIndex = entries.indexOf(newEntry);
    const entriesWithBalances = recalculateBalancesFromIndex(entries, insertedEntryIndex);
    await fsp.writeFile(MONEY_FILE_PATH, JSON.stringify(entriesWithBalances, null, 2));
    return [...entriesWithBalances]
      .reverse()
      .find(
        (entry) =>
          entry.date === newEntry.date &&
          entry.description === newEntry.description &&
          entry.income_eur === newEntry.income_eur &&
          entry.income_rub === newEntry.income_rub &&
          entry.outcome === newEntry.outcome
      );
  } catch (error) {
    createWriteError(moneyFileName, error);
    return null;
  }
};

const getRecentMoneyEntries = (limit = 10) => {
  return getMoneyEntries()
    .map((entry, index) => ({
      index,
      ...entry,
    }))
    .slice(-limit)
    .reverse();
};

const removeMoneyEntryByIndex = async (entryIndex) => {
  const entries = getMoneyEntries();

  if (!Number.isInteger(entryIndex) || entryIndex < 0 || entryIndex >= entries.length) {
    return null;
  }

  const removedEntry = { ...entries[entryIndex] };
  entries.splice(entryIndex, 1);

  try {
    const entriesWithBalances =
      entryIndex < entries.length ? recalculateBalancesFromIndex(entries, entryIndex) : entries;
    await fsp.writeFile(MONEY_FILE_PATH, JSON.stringify(entriesWithBalances, null, 2));
    return removedEntry;
  } catch (error) {
    createWriteError(moneyFileName, error);
    return null;
  }
};

module.exports = {
  getMoneyYearsList,
  getMoneyHistoryByYear,
  getMoneyHistoryForLastMonths,
  addMoneyEntry,
  getRecentMoneyEntries,
  removeMoneyEntryByIndex,
};
