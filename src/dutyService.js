const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'duty.json');

const getDuties = () => {
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
};

const addDuty = (duty) => {
  const duties = getDuties();
  duties.push(duty);
  fs.writeFileSync(filePath, JSON.stringify(duties, null, 2));
};

module.exports = { getDuties, addDuty };
