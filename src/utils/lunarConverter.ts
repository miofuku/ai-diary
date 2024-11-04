import moment from 'moment';
import 'moment-lunar';

export function convertToLunar(date: Date) {
  const lunarDate = moment(date).lunar();
  return {
    year: lunarDate.year(),
    month: lunarDate.month(),
    day: lunarDate.date(),
  };
} 