export function toChineseNumber(num: number): string {
  const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (num < 0 || num > 10) return num.toString(); // 只处理0-10的数字
  return chineseNumbers[num];
} 