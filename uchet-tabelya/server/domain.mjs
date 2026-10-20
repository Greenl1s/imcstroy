export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function text(value, label, max = 200, optional = false) {
  const v = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!v && !optional) throw new AppError(`Заполните поле «${label}»`);
  if (v.length > max) throw new AppError(`Поле «${label}» — не более ${max} символов`);
  return v;
}
export function monthDays(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AppError('Выберите корректные месяц и год');
  const [y, m] = month.split('-').map(Number);
  if (y < 2000 || y > 2100) throw new AppError('Год должен быть от 2000 до 2100');
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function shortName(name) {
  const [surname, ...parts] = name.trim().split(/\s+/);
  return surname + (parts.length ? ' ' + parts.map(p => p[0].toLocaleUpperCase('ru') + '.').join('') : '');
}
export function safeFilename(s) { return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 150) || 'Табель'; }
export function canReopen(user) { return user?.role === 'admin'; }
