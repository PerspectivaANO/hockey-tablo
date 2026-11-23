/**
 * Клиент API. Личность — только подписанная строка Telegram.WebApp.initData:
 * сервер проверяет подпись на каждом запросе. Ни id, ни множителей, ни очков
 * отсюда не отправляется — только матч, вариант и число шайб.
 */
import "./tg-wait.js";

const tg = window.Telegram && window.Telegram.WebApp;

/** Для отладки вне Телеграма подпись можно передать в адресе: #dev=<initData>. */
export function initData() {
  if (tg && tg.initData) return tg.initData;
  try {
    return new URLSearchParams(location.hash.slice(1)).get("dev") || "";
  } catch {
    return "";
  }
}

/** Сайт вне Телеграма: сессия, выданная после подтверждения входа в боте (хранится в браузере, на сервере только её хэш). */
const SESSION_KEY = "tablo.session";
export function sessionToken() {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}
export function saveSession(token) {
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {
    /* браузер не даёт хранить: вход придётся повторять */
  }
}
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* нечего чистить */
  }
}

/** Просит Телеграм разрешить боту писать человеку (нужно для уведомлений об итогах). Вне Телеграма разрешать нечего. */
export function askWriteAccess() {
  return new Promise((resolve) => {
    if (!tg || !tg.requestWriteAccess) return resolve(true);
    try {
      tg.requestWriteAccess((ok) => resolve(!!ok));
    } catch {
      resolve(false);
    }
  });
}

export function startParam() {
  return (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || "";
}

let offsetMs = 0;
/** Серверные часы: отсчёт до закрытия приёма не должен зависеть от часов телефона. */
export function serverNow() {
  return Date.now() + offsetMs;
}
export function syncClock(iso) {
  const t = Date.parse(iso);
  if (Number.isFinite(t)) offsetMs = t - Date.now();
}

/** Копия сайта на GitHub Pages: страницы там, а сервер (вход, броски, таблицы) на нашем адресе. Остальные адреса ходят на свой сервер. */
const API_BASE = location.hostname.endsWith(".github.io") ? "https://tablo.kids-hockey.online" : "";

/** Возвращает { ok, status, data }. Сетевой сбой — status 0. */
export async function api(path, opts = {}) {
  const signed = initData();
  const session = sessionToken();
  const headers = { Authorization: signed ? "tma " + signed : session ? "Bearer " + session : "tma ", ...(opts.headers || {}) };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const method = opts.method || (opts.body !== undefined ? "POST" : "GET");
  busy(1);
  try {
    // Чтение (GET) при обрыве связи пробуем ещё раз: повтор безопасен. Отправку (бросок, вход) не повторяем: она могла дойти.
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(API_BASE + path, {
          method,
          headers,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(25000),
        });
        let data = null;
        try {
          data = await res.json();
        } catch {
          /* пустое тело */
        }
        if (data && data.now) syncClock(data.now);
        return { ok: res.ok, status: res.status, data };
      } catch (err) {
        if (method !== "GET" || attempt >= 1) throw err;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  } catch {
    return { ok: false, status: 0, data: { error: "network", message: "Нет связи. Проверьте интернет." } };
  } finally {
    busy(-1);
  }
}

/** Тонкая полоска сверху, пока ждём сервер дольше 0,6 с: человек видит, что приложение работает. */
let inflight = 0;
let busyTimer = 0;
function busy(delta) {
  inflight = Math.max(0, inflight + delta);
  if (inflight > 0 && !busyTimer) busyTimer = setTimeout(() => document.body.classList.add("busy"), 600);
  if (inflight === 0) {
    clearTimeout(busyTimer);
    busyTimer = 0;
    document.body.classList.remove("busy");
  }
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

/** Грубый отпечаток устройства для защиты от фейковых приглашений (хранится только хэш). */
export async function deviceHash() {
  try {
    const raw = [navigator.userAgent, screen.width + "x" + screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language].join("|");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

export const telegram = tg;
