/**
 * Current date-time in IST (Asia/Kolkata), formatted as 'YYYY-MM-DDTHH:mm'
 * so it matches the value shape of <input type="datetime-local">.
 *
 * Previously this logic was copy-pasted inline in StarDetails and EditVidDialog.
 */
export const nowInIST = () => {
  const options = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

/**
 * Human-readable rendering of a stored date string.
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'No date available';
  const date = new Date(dateString);
  return isNaN(date) ? 'Invalid date' : date.toLocaleString();
};
