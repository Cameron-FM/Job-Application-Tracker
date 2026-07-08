export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formats 'YYYY-MM-DD' (or a datetime starting with it) as e.g. "7 Jul 2026".
export function fmtDate(value) {
  if (!value) return '';
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function isOverdue(dateStr) {
  return !!dateStr && String(dateStr).slice(0, 10) < todayStr();
}

export function isToday(dateStr) {
  return !!dateStr && String(dateStr).slice(0, 10) === todayStr();
}
