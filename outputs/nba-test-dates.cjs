exports.formatDate = function formatDate(date, timeZone, pattern) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(date).reduce((out, part) => {out[part.type] = part.value; return out;}, {});
  const month = new Intl.DateTimeFormat('en-US', {timeZone, month: 'short'}).format(date);
  if (pattern === 'yyyy-MM-dd') return parts.year + '-' + parts.month + '-' + parts.day;
  if (pattern === 'EEE, MMM d') return parts.weekday + ', ' + month + ' ' + Number(parts.day);
  if (pattern === 'h:mm a') return parts.hour + ':' + parts.minute + ' ' + parts.dayPeriod;
  throw new Error('Unsupported test date pattern: ' + pattern);
};
