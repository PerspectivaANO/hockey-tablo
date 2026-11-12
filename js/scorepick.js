import { h } from "./dom.js";

/**
 * «Прогноз счёта»: бесплатно, без шайб. Называете счёт, а после матча за точный счёт получаете 10 шайб в банк тура.
 * Принимается на матчи своих команд и на «Матч тура»; менять можно до закрытия приёма.
 */
export const SCORE_RULES = "Точный счёт: +10 шайб в банк тура. За неточный счёт ничего не начисляется";

function stepper(label, value, onChange, disabled) {
  const set = (v) => onChange(Math.max(0, Math.min(40, v)));
  return h("div", { class: "sp-team" },
    h("div", { class: "sp-name" }, label),
    h("div", { class: "sp-step" },
      h("button", { type: "button", class: "step", "aria-label": `${label}: меньше`, disabled, onclick: () => set(value - 1) }, "−"),
      h("span", { class: "sp-val" }, value),
      h("button", { type: "button", class: "step", "aria-label": `${label}: больше`, disabled, onclick: () => set(value + 1) }, "+")));
}

/** Блок на экране матча. draft — {home, away}, который человек сейчас выбирает. */
export function scoreBlock({ m, home, away, closed, draft, busy, onChange, onSave }) {
  if (!m.scorePickAllowed) return null;
  const saved = m.scorePick;
  const same = saved && saved.home === draft.home && saved.away === draft.away;
  return h("div", { class: "tile scorepick" },
    h("p", { class: "stitle" }, h("span", {}, "Прогноз счёта · без шайб"), h("span", {}, saved ? `ваш: ${saved.home}:${saved.away}` : "")),
    h("div", { class: "sp-row" },
      stepper(home, draft.home, (v) => onChange({ ...draft, home: v }), closed || busy),
      h("span", { class: "sp-colon", "aria-hidden": "true" }, ":"),
      stepper(away, draft.away, (v) => onChange({ ...draft, away: v }), closed || busy)),
    h("button", { type: "button", class: "cta small", disabled: closed || busy || same, onclick: onSave },
      closed ? "Приём закрыт" : same ? "Прогноз сохранён" : saved ? "Изменить прогноз" : "Сохранить прогноз"),
    h("p", { class: "note" }, SCORE_RULES + ". Закрывается вместе с приёмом бросков."));
}

/** Строка на карточке матча: прогноз и, после матча, что получилось. */
export function scoreLine(m) {
  const p = m.scorePick;
  if (!p) return null;
  const text = p.state === "done"
    ? (p.puckBonus > 0 ? `Прогноз счёта ${p.home}:${p.away}: точный счёт! +${p.puckBonus} шайб в банк тура`
      : p.points > 0 ? `Прогноз счёта ${p.home}:${p.away}: верный исход, +${p.points} очков`
      : `Прогноз счёта ${p.home}:${p.away}: мимо`)
    : p.state === "void" ? `Прогноз счёта ${p.home}:${p.away}: матч не состоялся`
    : `Ваш прогноз счёта: ${p.home}:${p.away}`;
  return h("span", { class: "done" + (p.state === "done" && p.points === 0 ? " miss" : "") }, text);
}
