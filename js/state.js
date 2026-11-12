import { api, askWriteAccess, serverNow } from "./api.js";
import { h } from "./dom.js";
import { clubKey, durWords } from "./format.js";

/** Общее состояние приложения. Экраны читают его и просят app.js перерисоваться. */
export const S = {
  me: null,
  leagues: [],
  /** Выбранная группа (id лиги) и вкладка Табло: upcoming | results. */
  leagueId: null,
  scope: "upcoming",
  screen: "home",
  pick: null,
  /** Открыт экран правил игры (доступен и до регистрации). */
  rules: false,
  go: () => {},
  render: () => {},
};

/** Свои команды человека (0–6). Пусто — он только следит. */
export const myTeams = () => (S.me && S.me.teams) || [];
export const myLeagueIds = () => [...new Set(myTeams().map((t) => t.leagueId))];
/** Свои команды по номеру: названия у разных возрастов области совпадают («Раменское» есть в каждом), номер — нет. */
export const myTeamIds = () => new Set(myTeams().map((t) => t.id));

/**
 * Клубы моих команд: название без года возраста («Спартак 2014» и «Спартак 2015» — один клуб; у области названия и так без года).
 * По ним отмечаются «наши ребята» — одноклубники других возрастов, а не сама выбранная команда.
 */
export function myClubKeys() {
  const keys = new Set();
  for (const t of myTeams()) {
    const lg = S.leagues.find((l) => l.id === t.leagueId);
    keys.add(clubKey(t.name, lg ? lg.birthYear : null));
  }
  return keys;
}

/**
 * Уведомления об итогах бросков. Включаем только с разрешением Телеграма; не разрешил — оставляем выключенными,
 * чтобы сервер не стучался впустую. Возвращает итоговое состояние.
 */
export async function setNotify(on) {
  const allowed = on ? await askWriteAccess() : true;
  const value = on && allowed;
  const r = await api("/api/me", { body: { notifyResults: value } });
  if (r.ok && S.me) S.me.notify = value;
  return value;
}

/**
 * Напоминания о матчах своих команд за 2 дня. «Да» сохраняется только с разрешением Телеграма на сообщения от бота;
 * без разрешения бот всё равно не сможет написать, поэтому сохраняем «нет». Возвращает итоговое состояние.
 */
export async function setRemind(on) {
  const allowed = on ? await askWriteAccess() : true;
  const value = on && allowed;
  const r = await api("/api/me", { body: { remindGames: value } });
  if (r.ok && S.me) S.me.remind = value;
  return value;
}

/** После первого принятого броска один раз просим разрешение на сообщения от бота. */
export async function askNotifyOnce() {
  let seen = false;
  try {
    seen = localStorage.getItem("tablo.notifyAsked") === "1";
    localStorage.setItem("tablo.notifyAsked", "1");
  } catch {
    /* хранилище недоступно — спросим ещё раз при следующем броске */
  }
  if (seen || !S.me || S.me.notify === false) return;
  await setNotify(true);
}

export const league = () => S.leagues.find((l) => l.id === S.leagueId) || null;

export function saveChoice() {
  try {
    localStorage.setItem("tablo.league", String(S.leagueId));
  } catch {
    /* хранилище может быть недоступно — не страшно */
  }
}
export function loadChoice() {
  try {
    return Number(localStorage.getItem("tablo.league")) || null;
  } catch {
    return null;
  }
}

let toastTimer = 0;
export function toast(text, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.className = "toast" + (isError ? " err" : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), isError ? 6000 : 3500);
}

export async function refreshMe() {
  const r = await api("/api/me");
  if (r.ok) {
    S.me = r.data;
    paintHeader();
  }
  return r;
}

export function paintHeader() {
  const bal = document.getElementById("bal");
  const sub = document.getElementById("subline");
  const me = S.me;
  bal.textContent = me && me.pucks ? String(me.pucks.left) : "—";
  sub.textContent = me ? `Тур ${me.tour.number} · банк шайб` : "Табло";
}

/** Живой отсчёт до закрытия бросков: они закрываются за 15 минут до начала матча. Слово «приём» не пишем: «закроется через 3 дня 1 час». */
export function countdown(m) {
  const el = h("span", { class: "cd" });
  el.dataset.close = String(Date.parse(m.closesAt));
  el.dataset.start = m.startsAt ? String(Date.parse(m.startsAt)) : "";
  el.dataset.status = m.status;
  paintCountdown(el);
  return el;
}

export function paintCountdown(el) {
  const close = Number(el.dataset.close);
  const start = el.dataset.start ? Number(el.dataset.start) : null;
  const now = serverNow();
  let text;
  let cls = "cd";
  if (el.dataset.status === "finished") text = "матч сыгран";
  else if (el.dataset.status === "cancelled") text = "матч отменён";
  else if (now >= close) {
    cls += " shut";
    text = start && now >= start ? "матч идёт или ждём итог" : "закрыт";
  } else {
    const left = close - now;
    if (left < 2 * 3600 * 1000) cls += " soon";
    text = "закроется через " + durWords(left);
  }
  if (el.textContent !== text) el.textContent = text;
  if (el.className !== cls) el.className = cls;
}

setInterval(() => document.querySelectorAll(".cd[data-close]").forEach(paintCountdown), 1000);
