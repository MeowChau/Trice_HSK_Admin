const studyDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function studyDate(date = new Date()): string {
  return studyDateFormatter.format(date);
}

// PostgreSQL DATE is a civil date, not an instant. pg can return a string or a
// Date at local midnight; using toISOString would shift it on UTC+7 hosts.
export function databaseDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
