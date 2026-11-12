import { h, mount } from "./dom.js";
import { S } from "./state.js";
import { RULES } from "./rules-text.js";

/** [[...]] подсвечивается: это данные, которые нужно заполнить до запуска. */
function withMarks(text) {
  const parts = text.split(/(\[\[.*?\]\])/g).filter(Boolean);
  return parts.map((s) => (s.startsWith("[[") ? h("span", { class: "todo" }, s.slice(2, -2)) : s));
}

export function renderRules(root) {
  mount(root, h("section", { class: "screen doc" },
    h("button", { type: "button", class: "cta ghost small back", onclick: () => { S.rules = false; S.render(); } }, "← Назад"),
    h("h1", {}, "Правила игры"),
    h("p", { class: "note" }, "Редакция 1, предварительная: текст ждёт проверки юристом."),
    RULES.map((s) => h("div", {},
      h("h2", {}, s.h),
      (s.p || []).map((t) => h("p", {}, withMarks(t))),
      s.ol ? h("ol", {}, s.ol.map((t) => h("li", {}, withMarks(t)))) : null)),
    h("button", { type: "button", class: "cta", onclick: () => { S.rules = false; S.render(); } }, "Понятно")));
}
