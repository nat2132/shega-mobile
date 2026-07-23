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

const ETHIOPIAN_MONTHS_OM = [
  'Fulbaana', 'Onkoloolessa', 'Sadaasa', 'Muddee', 'Amajjii', 'Guraandhala',
  'Bitooteessa', 'Ebla', 'Caamsaa', 'Waxabajjii', 'Adoolessa', 'Hagayya', 'Pagumee'
];

const ETHIOPIAN_MONTHS_TI = [
  'መስከረም', 'ጥቅምቲ', 'ሕዳር', 'ታሕሳስ', 'ጥሪ', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰነ', 'ሓምለ', 'ነሓሰ', 'ጳጐማን'
];

export const getEthiopianMonthNames = (language: string = 'en') => {
  switch (language) {
    case 'am': return ETHIOPIAN_MONTHS_AM;
    case 'om': return ETHIOPIAN_MONTHS_OM;
    case 'ti': return ETHIOPIAN_MONTHS_TI;
    default: return ETHIOPIAN_MONTHS;
  }
};

export const getEthiopianDaysInMonth = (year: number, month: number) => {
  if (month <= 12) return 30;
  // Pagumen (month 13)
  const isLeapYear = year % 4 === 0;
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

const ETHIOPIAN_DAYS_OM = [
  'Dilbata', 'Wiixata', 'Qibxata', 'Roobii', 'Kamisa', 'Jimaata', 'Sanbata'
];

const ETHIOPIAN_DAYS_TI = [
  'ሰንበት', 'ሰኑይ', 'ሰሉስ', 'ረቡዕ', 'ሓሙስ', 'ዓርቢ', 'ቀዳም'
];

export const getEthiopianDayNames = (language: string = 'en') => {
  switch (language) {
    case 'am': return ETHIOPIAN_DAYS_AM;
    case 'om': return ETHIOPIAN_DAYS_OM;
    case 'ti': return ETHIOPIAN_DAYS_TI;
    default: return ETHIOPIAN_DAYS;
  }
};

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
  const jdn = ethiopicEpoch + 365 * (year - 1) + Math.floor((year - 1) / 4) + 30 * (month - 1) + day - 1;
  
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

const getLocale = (language: string) => {
  switch (language) {
    case 'am': return 'am-ET';
    case 'ti': return 'am-ET';
    default: return 'en-US';
  }
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
    return date.toLocaleDateString(getLocale(language), {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } else {
    const { year, month, day } = toEthiopianDate(date);
    const monthName = getEthiopianMonthNames(language)[month - 1];
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
    return date.toLocaleDateString(getLocale(language), { month: 'short', day: 'numeric' });
  } else {
    const { month, day } = toEthiopianDate(date);
    const monthName = getEthiopianMonthNames(language)[month - 1];
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
    return date.toLocaleDateString(getLocale(language), { weekday: 'short' });
  } else {
    return getEthiopianDayNames(language)[dayIndex];
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
    if (language === 'am') return 'ዛሬ';
    if (language === 'om') return 'Har\'a';
    if (language === 'ti') return 'ሎሚ';
    return 'Today';
  } else if (diffDays === 1) {
    if (language === 'am') return 'ትላንት';
    if (language === 'om') return 'Kaleessa';
    if (language === 'ti') return 'ትማሊ';
    return 'Yesterday';
  } else {
    return formatShortDate(date, calendarType, language);
  }
};

/**
 * Formats a time string in Ethiopian 12hr format (local time)
 */
export const formatEthiopianTime = (dateStr: string, language: string = 'en'): string => {
  try {
    if (!dateStr) return '';
    let normalized = dateStr;
    if (!normalized.includes('T') && !normalized.includes('Z')) {
      normalized = normalized.replace(' ', 'T') + 'Z';
    }
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return '';
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // Ethiopian hour: 6:00 AM Gregorian is 12:00 local.
    // H_eth = (H_greg - 6 + 24) % 24
    const ethHours24 = (hours - 6 + 24) % 24;
    let ethHours12 = ethHours24 % 12;
    if (ethHours12 === 0) ethHours12 = 12;
    
    const minutesStr = String(minutes).padStart(2, '0');
    
    // 6:00 AM (local 12:00) to 5:59 PM (local 11:59) is day (ቀን)
    // 6:00 PM (local 12:00) to 5:59 AM (local 11:59) is night/evening (ማታ)
    const isDay = hours >= 6 && hours < 18;
    const dayStr = language === 'am' ? 'ቀን' : language === 'om' ? 'Guyyaa' : language === 'ti' ? 'ዕለት' : 'Day';
    const nightStr = language === 'am' ? 'ማታ' : language === 'om' ? 'Halkan' : language === 'ti' ? 'ለይቲ' : 'Night';
    const period = isDay ? dayStr : nightStr;
      
    return `${ethHours12}:${minutesStr} ${period}`;
  } catch {
    return '';
  }
};

/**
 * Convert an ISO / SQLite datetime string into a `Date` object.
 *
 * SQLite `CURRENT_TIMESTAMP` returns UTC text in the form
 * `"2026-06-06 11:14:22"`. `new Date('2026-06-06 11:14:22')` is parsed
 * as local time in some engines, so we explicitly append a `Z` (UTC)
 * when no timezone is present. This keeps device-local rendering and
 * Ethiopian shifts consistent across the app.
 */
export const parseLocalDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  let normalized = dateStr;
  if (!normalized.includes('T') && !normalized.includes('Z')) {
    normalized = normalized.replace(' ', 'T') + 'Z';
  }
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Convert a Gregorian hour (0–23, device-local) to an Ethiopian hour
 * (0–23). Ethiopian clock starts at 6 AM Gregorian = 12:00 (1st hour
 * of the day), so:
 *   H_eth = (H_greg - 6 + 24) % 24
 *
 * The returned hour is 0-indexed in 24h form. Callers that need the
 * 12-hour-with-period form should use `formatEthiopianTime` instead.
 */
export const toEthiopianHour = (gregorianHour: number): number => {
  if (!Number.isFinite(gregorianHour)) return 0;
  return ((gregorianHour - 6) % 24 + 24) % 24;
};

/**
 * Returns whether a Gregorian (device-local) hour falls in the
 * Ethiopian "day" (6:00–17:59, equivalent to 12:00–23:59 Ethiopian)
 * vs "night" (18:00–05:59, equivalent to 00:00–11:59 Ethiopian).
 */
export const isEthiopianDayHour = (gregorianHour: number): boolean => {
  if (!Number.isFinite(gregorianHour)) return true;
  return gregorianHour >= 6 && gregorianHour < 18;
};

/**
 * Time-formatting helper that respects the user's selected
 * `timeSystem` setting.
 *
 * - `timeSystem === 'ethiopian'` → calls `formatEthiopianTime` (12-hour
 *   Ethiopian clock with day/night period).
 * - `timeSystem === 'device'` → device-locale 12-hour (e.g. "2:30 PM")
 *   for en/am/om/ti, 24-hour for English when no AM/PM is preferred
 *   via the locale. (We default to 12-hour AM/PM for the four
 *   supported app languages, which is consistent with how the rest of
 *   the codebase already renders times.)
 *
 * Accepts the same inputs as `formatEthiopianTime`.
 */
export const formatTime = (
  dateStr: string,
  timeSystem: 'device' | 'ethiopian' = 'device',
  language: string = 'en',
): string => {
  if (timeSystem === 'ethiopian') {
    return formatEthiopianTime(dateStr, language);
  }
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const minutesStr = String(minutes).padStart(2, '0');
  const isPm = hours >= 12;
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const am = language === 'am' ? 'ጥዋት' : language === 'om' ? 'WD' : language === 'ti' ? 'ንጉሆ' : 'AM';
  const pm = language === 'am' ? 'ከሰዓት' : language === 'om' ? 'WB' : language === 'ti' ? 'ምሸት' : 'PM';
  return `${hour12}:${minutesStr} ${isPm ? pm : am}`;
};

/**
 * 24-hour "HH:00" formatter for the hour-bucketing logic in
 * peak-hours analytics. Always returns a string in device-local time
 * unless `timeSystem === 'ethiopian'`, in which case the hour is
 * shifted by -6 to align with the Ethiopian clock.
 */
export const formatHourLabel = (
  hour: number,
  timeSystem: 'device' | 'ethiopian' = 'device',
  language: string = 'en',
): string => {
  const h = timeSystem === 'ethiopian' ? toEthiopianHour(hour) : hour;
  if (timeSystem === 'ethiopian') {
    const dayStr = language === 'am' ? 'ቀን' : language === 'om' ? 'Guyyaa' : language === 'ti' ? 'ዕለት' : 'Day';
    const nightStr = language === 'am' ? 'ማታ' : language === 'om' ? 'Halkan' : language === 'ti' ? 'ለይቲ' : 'Night';
    const isDay = isEthiopianDayHour(hour);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:00 ${isDay ? dayStr : nightStr}`;
  }
  return `${String(h).padStart(2, '0')}:00`;
};

