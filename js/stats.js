import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { S } from "./state.js";

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const dayTitle = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** «Статистика»: заходы по дням, только для владельца (сервер отвечает 404 всем остальным). Сам владелец в цифры не входит. */
export function renderStats(root) {
  const body = h("div", {}, h("p", { class: "empty" }, "Загрузка…"));
  mount(root, h("section", { class: "screen" },
    h("button", { type: "button", class: "cta ghost small back", onclick: () => S.go("home") }, "← Назад"),
    h("h1", { class: "h1" }, "Статистика"),
    h("p", { class: "lede" }, "Заходы по дням (сутки по Москве). Вы сами в цифры не входите."),
    body));
  api("/api/admin/stats").then((r) => {
    if (!r.ok) return mount(body, h("p", { class: "empty" }, (r.data && r.data.message) || "Не получилось загрузить."));
    const { days, totals } = r.data;
    const row = (label, value) => h("div", { class: "stat-row" }, h("span", {}, label), h("b", {}, String(value)));
    mount(body,
      h("div", { class: "tile" },
        row("Зарегистрировано всего", totals.registered),
        row("Хоть раз бросали", totals.madeBets)),
      ...days.map((d) => h("div", { class: "tile" },
        h("div", { class: "stitle" }, dayTitle(d.day)),
        row("Зашли в Табло", d.active),
        row("Новые", d.newUsers),
        row("Нажали «Старт» в боте", d.botStart),
        row("Начали вход на сайте (попыток)", d.loginBegin),
        row("Открыли бота по ссылке входа", d.loginBot),
        row("Подтвердили вход на сайте", d.loginDone),
        row("Бросали (людей / бросков)", `${d.betters} / ${d.bets}`),
        row("Прогнозов счёта", d.picks),
        row("Ответов на вопрос дня", d.quiz),
        row("Сообщений на трибуне", d.posts),
        row("Фейр-плей (уникальных)", d.fairplay))));
  });
}
