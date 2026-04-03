export function dateKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDateKey(): string {
  return dateKeyFromDate(new Date());
}

export function parseDateKeyToLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = parseDateKeyToLocalDate(dateKey);
  date.setDate(date.getDate() + days);
  return dateKeyFromDate(date);
}

export function getWeekDateKeys(dateKey: string): string[] {
  const date = parseDateKeyToLocalDate(dateKey);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + index);
    return dateKeyFromDate(next);
  });
}