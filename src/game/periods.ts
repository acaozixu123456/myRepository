// 任务与商店共用已合并商店的当地周一 05:00 口径。
// 按日历回退，夏令时转换日也不假定一天固定 24 小时。
export function periodKeys(now = Date.now()): { dailyKey: string; weeklyKey: string } {
  const day = new Date(now);
  if (!Number.isFinite(day.getTime())) day.setTime(0);
  if (day.getHours() < 5) day.setDate(day.getDate() - 1);
  const key = () => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const dailyKey = key();
  day.setDate(day.getDate() - (day.getDay() + 6) % 7);
  return { dailyKey, weeklyKey: key() };
}

export const dailyKey = (now = Date.now()): string => periodKeys(now).dailyKey;
export const weeklyKey = (now = Date.now()): string => periodKeys(now).weeklyKey;
