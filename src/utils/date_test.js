// Simplified version of the date-utils functions
const toEthiopianDate = (date) => {
  const jdn = Math.floor(date.getTime() / 86400000) + 2440588;
  const r = (jdn - 1723855) % 1461; // Changed 1723856 to 1723855 to match? No, wait.
  
  // Formulas for conversion (integer specific)
  const jdn_adj = jdn - 1723856;
  const year = Math.floor((4 * jdn_adj + 3) / 1461);
  const r2 = jdn_adj - Math.floor((1461 * year) / 4);
  const month = Math.floor((r2 + 30) / 30);
  const day = r2 - (month - 1) * 30 + 1;
  
  return { year: year + 1, month, day };
};

const fromEthiopianToDate = (year, month, day) => {
  const jdn = (year - 1) * 365 + Math.floor(year / 4) + (month - 1) * 30 + day + 1723855;
  return new Date((jdn - 2440588) * 86400000);
};

// Test 1: Today
const today = new Date();
const eth = toEthiopianDate(today);
console.log('Today:', today.toDateString());
console.log('Ethiopian:', eth);
const back = fromEthiopianToDate(eth.year, eth.month, eth.day);
console.log('Back:', back.toDateString());

// Test 2: Pagumen
const pagumen = fromEthiopianToDate(2016, 13, 1);
console.log('2016-13-01 Ethiopian -> Gregorian:', pagumen.toDateString());
console.log('Back to Ethiopian:', toEthiopianDate(pagumen));

