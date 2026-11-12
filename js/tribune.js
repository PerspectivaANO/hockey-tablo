import { api, serverNow } from "./api.js";
const telegram = window.Telegram && window.Telegram.WebApp;
import { h, mount } from "./dom.js";
import { timeAgo } from "./format.js";
import { groupChips, leagueHead } from "./picker.js";
import { S, myLeagueIds, toast } from "./state.js";
import { inviteTile } from "./daily.js";

const PAGE = 10;
const CLIP = 280;

/** Трибуна — родители одной группы. Лента короткая: 10 свежих сообщений, остальное по кнопке. */
let tribuneLeague = null;

export async function renderTribune(root) {
  const mineIds = myLeagueIds();
  // Трибуна открыта родителям группы. Кто только следит, трибуны не видит: тема детская.
  if (mineIds.length === 0) {
    return mount(root, h("section", { class: "screen" },
      inviteTile(),
      h("p", { class: "stitle" }, h("span", {}, "Трибуна")),
      h("div", { class: "tile" },
        h("p", { class: "dq" }, "Трибуна для родителей группы"),
        h("p", { class: "note" }, "Вы следите за матчами без своей команды, поэтому трибуна закрыта: там общаются родители игроков группы. Если у вас играет ребёнок, добавьте его команду."),
        h("button", { type: "button", class: "cta", onclick: () => S.go("teams") }, "Выбрать свои команды"))));
  }
  if (!mineIds.includes(tribuneLeague)) tribuneLeague = mineIds[0];
  const lg = S.leagues.find((l) => l.id === tribuneLeague);
  const list = h("div", {});
  const more = h("button", { type: "button", class: "cta ghost more", hidden: true }, "Показать ещё");
  const input = h("textarea", { class: "field", rows: 2, maxlength: 1000, placeholder: "Что скажете трибуне?", "aria-label": "Сообщение" });
  const send = h("button", { type: "button", class: "cta small", onclick: post }, "Отправить");
  let lastId = null;
  // Подсказка вместо публикации: поиск соперников идёт в другое приложение
  const notice = h("div", { class: "tile notice", hidden: true });
  const showNotice = (text, link) => {
    const open = () => (telegram && telegram.openTelegramLink ? telegram.openTelegramLink(link) : window.open(link, "_blank", "noopener"));
    notice.replaceChildren(h("p", { class: "note" }, text), h("button", { type: "button", class: "cta small", onclick: open }, "Открыть «Товарняки»"));
    notice.hidden = false;
  };

  async function post() {
    const text = input.value.trim();
    if (!text) return;
    send.disabled = true;
    const r = await api("/api/tribune", { body: { body: text, leagueId: tribuneLeague } });
    send.disabled = false;
    if (!r.ok && r.data && r.data.link) return showNotice(r.data.message, r.data.link);
    if (!r.ok) return toast((r.data && r.data.message) || "Не получилось отправить.", true);
    notice.hidden = true;
    input.value = "";
    list.replaceChildren();
    lastId = null;
    void load();
  }

  async function report(id) {
    const r = await api(`/api/tribune/${id}/report`, { body: {} });
    if (!r.ok) return toast("Не получилось отправить жалобу.", true);
    toast(r.data.status === "hidden" ? "Спасибо, сообщение скрыто до проверки модератором." : "Спасибо, жалоба отправлена модератору.");
    list.replaceChildren();
    lastId = null;
    void load();
  }

  /** Имя автора. По нажатию открывается его Телеграм-юзернейм: так у общения есть ответственность, а в ленте айди не светится. */
  function authorName(p) {
    if (p.userId === S.me.id) return h("span", {}, p.author);
    const info = h("span", { class: "tg", hidden: true });
    const btn = h("button", { type: "button", class: "namebtn", "aria-expanded": "false", onclick: () => {
      const open = info.hidden;
      info.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    } }, p.author);
    if (p.username) {
      const url = `https://t.me/${p.username}`;
      info.append(h("a", { href: url, onclick: (e) => { if (telegram && telegram.openTelegramLink) { e.preventDefault(); telegram.openTelegramLink(url); } } }, `@${p.username}`));
    } else info.append("Телеграм-юзернейм не указан");
    return h("span", { class: "author" }, btn, info);
  }

  function postEl(p) {
    const long = p.body.length > CLIP;
    const body = h("div", { class: "body" + (long ? " clip" : "") }, p.body);
    return h("div", { class: "post" },
      h("div", { class: "who" }, authorName(p), h("span", {}, timeAgo(p.createdAt, serverNow()))),
      body,
      long ? h("button", { type: "button", class: "link", onclick: (e) => { body.classList.remove("clip"); e.target.remove(); } }, "Читать полностью") : null,
      p.userId === S.me.id ? null : h("button", { type: "button", class: "link", onclick: () => report(p.id) }, "Пожаловаться"));
  }

  async function load() {
    more.disabled = true;
    const r = await api(`/api/tribune?leagueId=${tribuneLeague}&limit=${PAGE}${lastId ? `&before=${lastId}` : ""}`);
    more.disabled = false;
    if (!r.ok) return mount(list, h("p", { class: "empty" }, (r.data && r.data.message) || "Не удалось загрузить трибуну."));
    const { posts, hasMore } = r.data;
    if (posts.length === 0 && lastId === null) mount(list, h("p", { class: "empty" }, "На трибуне пока тихо. Напишите первым."));
    else for (const p of posts) list.append(postEl(p));
    if (posts.length) lastId = posts[posts.length - 1].id;
    more.hidden = !hasMore;
  }
  more.addEventListener("click", load);

  mount(root, h("section", { class: "screen" },
    inviteTile(),
    groupChips({ leagueIds: mineIds, current: tribuneLeague, onPick: (id) => { tribuneLeague = id; renderTribune(root); } }),
    leagueHead(lg),
    h("p", { class: "stitle" }, h("span", {}, "Трибуна · родители группы")),
    input, notice, h("div", { class: "right mt8" }, send),
    h("div", { class: "rink-rule" }),
    list, more,
    h("p", { class: "note" }, "Тема детская: пишем уважительно. Три жалобы скрывают сообщение до проверки модератором.")));
  void load();
}
