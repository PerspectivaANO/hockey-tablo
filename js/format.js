const MSK = "Europe/Moscow";

export const num = (x) => String(x).replace(".", ",");
export const fmtMult = (m) => "×" + num(m);

/** Ниже 1% показываем десятые: редкое событие не должно читаться как невозможное. */
export function pct(p) {
  const v = p * 100;
  if (v < 1) return (v < 0.1 ? "меньше 0,1" : v.toFixed(1).replace(".", ",")) + "%";
  return Math.round(v) + "%";
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const pucks = (n) => `${n} ${plural(n, "шайба", "шайбы", "шайб")}`;

/** «вс, 25 окт · 10:00» по Москве; без времени — «время уточняется». */
export function whenText(startsAt, day) {
  const d = new Date(startsAt || day);
  const date = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", timeZone: MSK }).format(d);
  if (!startsAt) return `${date} · время уточняется`;
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: MSK }).format(d);
  return `${date} · ${time}`;
}

export function shortDate(iso) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: MSK }).format(new Date(iso));
}

/**
 * Время до события словами, с верными окончаниями: «3 дня 1 час», «2 часа 15 минут», «14 мин 30 сек», «45 сек».
 * Нулевые хвосты не пишем («3 дня», а не «3 дня 0 часов»).
 */
export function durWords(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hh = Math.floor((s % 86400) / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const part = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;
  if (d > 0) return [part(d, "день", "дня", "дней"), hh > 0 ? part(hh, "час", "часа", "часов") : ""].filter(Boolean).join(" ");
  if (hh > 0) return [part(hh, "час", "часа", "часов"), mm > 0 ? part(mm, "минута", "минуты", "минут") : ""].filter(Boolean).join(" ");
  if (mm > 0) return [`${mm} мин`, ss > 0 ? `${ss} сек` : ""].filter(Boolean).join(" ");
  return `${ss} сек`;
}

export function dur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hh = Math.floor((s % 86400) / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (d > 0) return `${d} д ${hh} ч`;
  if (hh > 0) return `${hh} ч ${String(mm).padStart(2, "0")} мин`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/** К названию на сайте ФХМ дописан год возраста («Русь 2016»); в интерфейсе он не нужен. */
export function teamName(name, birthYear) {
  return String(name).replace(new RegExp(`\\s*${birthYear}\\s*$`), "").trim() || name;
}

export function timeAgo(iso, now) {
  const m = Math.floor((now - Date.parse(iso)) / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const hh = Math.floor(m / 60);
  if (hh < 24) return `${hh} ч назад`;
  return shortDate(iso);
}

/** Заголовок дня в ленте: «вс, 18 октября» по Москве. */
export function dayHeader(startsAt, day) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", timeZone: MSK }).format(new Date(startsAt || day));
}

/** Ключ дня по Москве — чтобы заголовок не повторялся у матчей одного дня. */
export function dayKey(startsAt, day) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: MSK }).format(new Date(startsAt || day));
}

/** Ключ клуба: название без года возраста («Спартак 2014» и «Спартак 2015» — один клуб); год, стоящий внутри названия, не трогаем. */
export function clubKey(name, birthYear) {
  const n = birthYear ? String(name).replace(new RegExp(`\s*${birthYear}\s*$`), "") : String(name);
  return n.trim().toLowerCase();
}
