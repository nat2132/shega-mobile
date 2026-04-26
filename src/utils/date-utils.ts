/**
 * Ethiopian Calendar Utility
 * 
 * The Ethiopian calendar (Ge 'ez calendar) is the principal calendar used in Ethiopia.
 * It is a solar calendar which in turn derives from the Egyptian calendar.
 */

const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimit', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Senie', 'Hamlie', 'Nehase', 'Pagumen'
];

export const getEthiopianMonthNames = (language: string = 'en') => 
  language === 'am' ? ETHIOPIAN_MONTHS_AM : ETHIOPIAN_MONTHS;

export const getEthiopianDaysInMonth = (year: number, month: number) => {
  if (month <= 12) return 30;
  // Pagumen (month 13)
  const isLeapYear = (year + 1) % 4 === 0;
  return isLeapYear ? 6 : 5;
};

const ETHIOPIAN_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
];

const ETHIOPIAN_DAYS = [
  'Eud', 'Segno', 'Maksegno', 'Rob', 'Hamus', 'Arb', 'Kidame'
];

const ETHIOPIAN_DAYS_AM = [
  'እሁድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'አርብ', 'ቅዳሜ'
];

/**
 * Converts a Gregorian Date to Ethiopian Date
 */
export const toEthiopianDate = (date: Date) => {
  // Guard against invalid dates
  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }

  // Use a constant for the jdn of 1/1/1 Ethiopian
  const ethiopicEpoch = 1723856;
  
  // Calculate JDN (Julian Day Number)
  // We use local date components to avoid timezone shifts during conversion
  const yr = date.getFullYear();
  const mo = date.getMonth() + 1;
  const dy = date.getDate();

  const a = Math.floor((14 - mo) / 12);
  const y = yr + 4800 - a;
  const m = mo + 12 * a - 3;
  const jdn = dy + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

  const r = (jdn - ethiopicEpoch) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  
  const year = 4 * Math.floor((jdn - ethiopicEpoch) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  
  return { year: year + 1, month: Math.floor(month), day: Math.floor(day) };
};

/**
 * Converts an Ethiopian Date to Gregorian Date
 */
export const fromEthiopianToDate = (year: number, month: number, day: number) => {
  const ethiopicEpoch = 1723856;
  const jdn = ethiopicEpoch + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day - 1;
  
  // Convert JDN back to Gregorian
  let l = jdn + 68569;
  let n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  let i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  let j = Math.floor((80 * l) / 2447);
  const d = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const m = j + 2 - 12 * l;
  const y = 100 * (n - 49) + i + l;
  
  return new Date(y, m - 1, d);
};

/**
 * Formats a date based on the calendar type preference
 */
export const formatDate = (
  date: Date, 
  calendarType: 'ethiopian' | 'gregorian', 
  language: string = 'en'
) => {
  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }

  if (calendarType === 'gregorian') {
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'am-ET', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } else {
    const { year, month, day } = toEthiopianDate(date);
    const monthName = language === 'am' ? ETHIOPIAN_MONTHS_AM[month - 1] : ETHIOPIAN_MONTHS[month - 1];
    return `${monthName} ${day}, ${year}`;
  }
};

/**
 * Formats a short date (e.g. Month Day)
 */
export const formatShortDate = (
  date: Date, 
  calendarType: 'ethiopian' | 'gregorian',
  language: string = 'en'
) => {
  if (calendarType === 'gregorian') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    const { month, day } = toEthiopianDate(date);
    const monthName = language === 'am' ? ETHIOPIAN_MONTHS_AM[month - 1] : ETHIOPIAN_MONTHS[month - 1];
    return `${monthName.substring(0, 3)} ${day}`;
  }
};

/**
 * Returns the day name (e.g. Mon, Segno)
 */
export const getDayName = (
  date: Date,
  calendarType: 'ethiopian' | 'gregorian',
  language: string = 'en'
) => {
  const dayIndex = date.getDay(); // 0 is Sunday
  if (calendarType === 'gregorian') {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return language === 'am' ? ETHIOPIAN_DAYS_AM[dayIndex] : ETHIOPIAN_DAYS[dayIndex];
  }
};
/**
 * Returns a friendly date string (Today, Yesterday, or short format)
 */
export const getFriendlyDate = (
  date: Date,
  calendarType: 'ethiopian' | 'gregorian',
  language: string = 'en'
) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return language === 'am' ? 'ዛሬ' : 'Today';
  } else if (diffDays === 1) {
    return language === 'am' ? 'ትላንት' : 'Yesterday';
  } else {
    return formatShortDate(date, calendarType, language);
  }
};
