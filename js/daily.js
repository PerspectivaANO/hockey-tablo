import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { S, toast } from "./state.js";

const DOTS = 7;

function dots(days) {
  const d = Math.min(DOTS, days);
  return h("div", { class: "chips", "aria-hidden": "true" },
    Array.from({ length: DOTS }, (_, i) => h("span", { class: "dot" + (i < d ? " on" : "") }, i < d ? "✓" : i + 1)));
}

function streakLine(s) {
  return h("div", { class: "tile row streak" },
    h("div", {},
      h("div", { class: "sub" }, "Серия заходов"),
      h("div", { class: "big" }, `${s.days} ${s.days === 1 ? "день" : s.days < 5 && s.days > 0 ? "дня" : "дней"}`),
      dots(s.days)),
    h("div", { class: "right" },
      h("div", { class: "sub" }, "Бонус к очкам"),
      h("div", { class: "big" }, `+${s.bonusPct}%`)));
}

/**
 * Вопрос дня — викторина по сыгранным играм. Шайбы не тратятся. Верный ответ даёт +5% к очкам, неверный +1%;
 * бонус копится день за днём в течение недели (не больше +35%), пропущенный день обнуляет его, в понедельник он начинается заново.
 */
export function dailyTile() {
  const box = h("div", {});
  void load();

  async function load() {
    const r = await api("/api/daily");
    if (!r.ok) return mount(box, null);
    // При заходе на экран результат прошлого ответа не показываем: он виден только сразу после ответа
    draw(r.data, false);
  }

  async function answer(pick) {
    const r = await api("/api/daily", { body: { pick } });
    if (!r.ok) {
      toast((r.data && r.data.message) || "Не получилось сохранить ответ.", true);
      return load();
    }
    // Шапка и расчёт бросков берут бонус из профиля: обновляем его сразу
    if (S.me) { S.me.streakDays = r.data.streak.days; S.me.bonusPct = r.data.streak.bonusPct; }
    draw(r.data, true);
  }

  function draw(d, showResult) {
    const q = d.question;
    if (!d.answered && q) {
      return mount(box, h("div", { class: "tile" },
        h("div", { class: "stitle" }, h("span", {}, "Вопрос дня · викторина"), h("span", {}, `бонус +${d.streak.bonusPct}%`)),
        h("p", { class: "dq" }, q.text),
        h("div", { class: `opts c${Math.min(3, q.options.length)} mt8` },
          q.options.map((o) => h("button", { type: "button", class: "opt", onclick: () => answer(o.key) }, h("span", { class: "lbl" }, o.label)))),
        h("p", { class: "note" }, "Без шайб. Верный ответ даёт +5% к очкам, неверный +1%. Бонус копится день за днём в течение недели, максимум +35%. Пропустите день — он обнулится, а в понедельник он в любом случае начинается заново.")));
    }
    const res = d.result;
    mount(box,
      streakLine(d.streak),
      q && res && showResult ? h("div", { class: "tile quiz " + (res.correct ? "ok" : "miss") },
        h("p", { class: "dq" }, res.correct ? `Верно! +${res.gainPct}% к очкам` : `Не угадали. +${res.gainPct}% к очкам`),
        h("p", { class: "note" }, q.text),
        h("p", { class: "note" }, res.correct ? "Ваш ответ совпал с правильным." : `Правильный ответ: ${res.correctLabel}.`),
        h("p", { class: "note" }, "Новый вопрос — завтра.")) : d.answered && q ? h("p", { class: "note" }, "Вопрос дня уже отвечен. Новый — завтра.") : null);
  }

  return box;
}

export function inviteTile() {
  const n = S.me ? S.me.invitedPlayed || 0 : 0;
  return h("button", { type: "button", class: "tile invite", onclick: () => S.go("invite") },
    h("span", {}, h("b", {}, "Позвать своих"), h("small", {}, `+5 шайб к банку за каждого, кто сыграет · пришло ${n}`)),
    h("span", { class: "chev", "aria-hidden": "true" }, "›"));
}
