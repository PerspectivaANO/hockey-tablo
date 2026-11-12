import { api, askWriteAccess, deviceHash, startParam } from "./api.js";
import { h, mount } from "./dom.js";
import { teamPicker } from "./teampicker.js";
import { S, paintHeader, toast } from "./state.js";

const draft = { adult: false, name: null, gender: null, remind: null, selected: new Map() };

/** Как на сервере (src/http/app.ts): буквы, пробел, дефис, апостроф, точка; 2–30 знаков. */
const NAME_RE = /^[\p{L}][\p{L} '’.\-]{1,29}$/u;
const cleanName = (s) => s.trim().replace(/\s+/g, " ");

/**
 * Первый вход: имя, пол (для обезличенной аналитики аудитории), подтверждение 18+ и, по желанию,
 * свои команды. Команд может быть несколько (дети в разных возрастах) или ни одной — тогда человек
 * просто следит. Команды можно менять позже. Имя подставляется из Телеграма, его можно исправить.
 */
export function renderOnboarding(root) {
  if (draft.name === null) draft.name = (S.me && !S.me.profileDone ? S.me.name : "") || "";
  if (S.me && S.me.adult) draft.adult = true;
  const ready = () => draft.adult && NAME_RE.test(cleanName(draft.name)) && !!draft.gender && draft.remind !== null;
  const cta = h("button", { type: "button", class: "cta", disabled: !ready() }, "Начать");
  const refresh = () => {
    cta.disabled = !ready();
    cta.textContent = draft.selected.size === 0 ? "Начать, только слежу" : "Начать";
  };

  const nameInput = h("input", {
    type: "text", class: "field", id: "name", value: draft.name, maxlength: "30", autocomplete: "given-name",
    placeholder: "Например, Елена", oninput: (e) => { draft.name = e.target.value; refresh(); },
  });
  const genderBtns = [["m", "Мужчина"], ["f", "Женщина"]].map(([key, label]) =>
    h("button", {
      type: "button", "aria-pressed": String(draft.gender === key),
      onclick: () => {
        draft.gender = key;
        for (const b of genderBtns) b.setAttribute("aria-pressed", String(b.dataset.g === draft.gender));
        refresh();
      },
      dataset: { g: key },
    }, label));

  const remindBtns = [[true, "Да, напоминайте"], [false, "Нет, я просто смотрю"]].map(([key, label]) =>
    h("button", {
      type: "button", "aria-pressed": String(draft.remind === key),
      onclick: () => {
        draft.remind = key;
        for (const b of remindBtns) b.setAttribute("aria-pressed", String((b.dataset.r === "1") === draft.remind));
        refresh();
      },
      dataset: { r: key ? "1" : "0" },
    }, label));

  cta.addEventListener("click", async () => {
    cta.disabled = true;
    // «Да» сохраняется только с разрешением Телеграма на сообщения от бота
    const remind = draft.remind === true && (await askWriteAccess());
    const payload = { adult: true, displayName: cleanName(draft.name), gender: draft.gender, teamIds: [...draft.selected.keys()], remindGames: remind };
    const code = startParam();
    if (/^L[0-9a-z]{1,10}$/i.test(code)) payload.inviteCode = code;
    const dh = await deviceHash();
    if (dh) payload.deviceHash = dh;
    const r = await api("/api/me", { body: payload });
    if (!r.ok) {
      toast((r.data && r.data.message) || "Не получилось сохранить. Попробуйте ещё раз.", true);
      refresh();
      return;
    }
    S.me = r.data;
    const first = r.data.teams[0];
    if (first) S.leagueId = first.leagueId;
    paintHeader();
    toast("Готово. В банке 100 шайб на этот тур.");
    S.go("home");
  });

  mount(root, h("section", { class: "screen" },
    h("h1", { class: "h1" }, "Прогнозы & результаты"),
    h("p", { class: "lede" }, "Родители детского хоккея Москвы предсказывают матчи и соревнуются на трибуне. Деньги в игре не участвуют."),
    h("ul", { class: "rules" },
      h("li", {}, "Шайбы выдаются бесплатно — 100 на каждый тур. Купить, пополнить, вывести или передать их нельзя."),
      h("li", {}, "Очки и места в рейтинге — только за точность прогнозов."),
      h("li", {}, "Играют только взрослые. Дети не регистрируются.")),
    h("button", { type: "button", class: "link", onclick: () => { S.rules = true; S.render(); } }, "Читать правила игры полностью"),
    h("div", { class: "rink-rule" }),
    h("label", { class: "lede", for: "name" }, "Как вас зовут? Так вас увидят на трибуне и в рейтинге."),
    nameInput,
    h("p", { class: "lede" }, "Вы:"),
    h("div", { class: "segs" }, genderBtns),
    h("label", { class: "check" },
      h("input", { type: "checkbox", id: "adult", checked: draft.adult, onchange: (e) => { draft.adult = e.target.checked; refresh(); } }),
      h("span", {}, "Мне исполнилось 18 лет, я прочитал(а) правила игры и принимаю их")),
    h("div", { class: "rink-rule" }),
    h("p", { class: "lede" }, "За кого болеете? Выберите свои команды: можно несколько, например, если дети играют в разных возрастах. Если команды нет, ничего не отмечайте."),
    teamPicker({ selected: draft.selected, onChange: refresh }),
    h("div", { class: "rink-rule" }),
    h("p", { class: "lede" }, "Напоминать о матчах ваших команд? За 2 дня до игры бот пришлёт сообщение, если вы ещё не сделали бросок. Если откажетесь, будете просто смотреть таблицы и результаты."),
    h("div", { class: "segs" }, remindBtns),
    cta,
    h("p", { class: "note" }, "Команды можно изменить потом: кнопка «Мои команды» вверху. Мы храним только ваш Телеграм-id, имя, пол и выбранные команды. Пол не показывается и нужен только для общей статистики. Ваше имя видно на трибуне и в рейтинге, а по нажатию на имя на трибуне — Телеграм-юзернейм.")));
  refresh();
}
