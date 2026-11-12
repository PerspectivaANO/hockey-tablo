import { api, saveSession } from "./api.js";
import { h, mount } from "./dom.js";

/**
 * Вход на сайте вне Телеграма. Сайт просит заявку, показывает код и ссылку на бота; человек в боте сверяет код и нажимает «Войти»;
 * страница каждые 2 секунды спрашивает, подтвердили ли вход, и получает сессию. Пароли не нужны: личность — аккаунт Телеграма.
 */
const POLL_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function renderLogin(root, note) {
  const box = h("div", {});
  mount(root, h("section", { class: "screen" },
    h("div", { class: "tile login" },
      h("div", { class: "stitle" }, h("span", {}, "Вход в «Табло»")),
      h("p", { class: "note" }, note || "Приложение работает и в обычном браузере. Вход через ваш аккаунт в Telegram: бот попросит подтвердить, пароли не нужны."),
      box)));
  idle();

  function idle(message) {
    mount(box,
      message ? h("p", { class: "note warn" }, message) : null,
      h("button", { type: "button", class: "cta", onclick: begin }, "Войти через Telegram"),
      h("p", { class: "note" }, "Игра бесплатная и только для совершеннолетних (18+), деньги не участвуют."));
  }

  async function begin() {
    const r = await api("/api/auth/start", { method: "POST", body: {} });
    if (!r.ok) return idle((r.data && r.data.message) || "Не получилось начать вход. Попробуйте через минуту.");
    const { token, code, botLink, expiresInSec } = r.data;
    const until = Date.now() + expiresInSec * 1000;
    let stopped = false;
    mount(box,
      h("p", { class: "note" }, "1. Нажмите кнопку: откроется бот в Telegram. В нём нажмите «Старт»."),
      h("a", { class: "cta", href: botLink, target: "_blank", rel: "noopener" }, "Открыть Telegram"),
      h("p", { class: "note" }, "2. Бот пришлёт код. Если он совпадает с кодом ниже, нажмите в боте «Войти»."),
      h("div", { class: "logincode", role: "status", "aria-label": "Код входа" }, code),
      h("p", { class: "note" }, "Ждём подтверждения в Telegram…"),
      h("button", { type: "button", class: "cta ghost", onclick: () => { stopped = true; idle(); } }, "Отмена"));
    while (!stopped) {
      await sleep(POLL_MS);
      if (stopped) return;
      if (Date.now() > until) return idle("Время вышло. Начните вход заново.");
      const p = await api(`/api/auth/poll?token=${encodeURIComponent(token)}`);
      if (stopped) return;
      if (!p.ok) {
        if (p.status === 0 || p.status >= 500) continue; // обрыв связи: пробуем ещё
        return idle((p.data && p.data.message) || "Не получилось проверить вход. Начните заново.");
      }
      const state = p.data.state;
      if (state === "approved" && p.data.session) {
        saveSession(p.data.session);
        location.reload();
        return;
      }
      if (state === "denied") return idle("Вход отменён в Telegram. Если это были вы, начните заново.");
      if (state === "expired") return idle("Ссылка устарела. Начните вход заново.");
    }
  }
}
