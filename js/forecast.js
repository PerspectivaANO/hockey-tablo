import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { teamName } from "./format.js";
import { S, toast } from "./state.js";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const when = (iso) => {
  const d = new Date(Date.parse(iso) + 3 * 3600 * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** Где показывать вопросы: по группам своих команд; у тех, кто только следит, один вопрос выбранной группы. */
function scopeOf(lg) {
  const mine = ((S.me && S.me.teams) || []).map((t) => t.leagueId);
  if (mine.length === 0) return "one";
  return mine.includes(lg.id) ? "all" : "none";
}

/**
 * Вопросы об итогах этапа. По умолчанию каждый — одна свёрнутая строка: сам вопрос и коротко итог («Вы: Спартак · так же
 * ответили 40%»). Раскрывается по нажатию; после ответа снова сворачивается. Главный вопрос (первый без ответа) идёт над таблицей,
 * остальные под ней. Возвращает два блока: top и bottom.
 */
export function forecastBlock(lg) {
  const top = h("div", {});
  const bottom = h("div", {});
  const scope = scopeOf(lg);
  if (scope === "none") return { top, bottom };
  const expanded = new Set();
  const editing = new Set();
  let list = [];

  async function load() {
    const r = await api(`/api/forecast?leagueId=${lg.id}`);
    if (!r.ok) { mount(top); mount(bottom); return; }
    list = r.data.questions;
    draw();
  }

  async function choose(q, teamId, buttons) {
    if (!S.me || !S.me.adult) return toast("Сначала завершите регистрацию.", true);
    for (const b of buttons) b.disabled = true;
    const r = await api(`/api/forecast/${q.id}/pick`, { body: { teamId } });
    if (!r.ok) {
      toast((r.data && r.data.message) || "Не получилось сохранить ответ.", true);
      return load();
    }
    editing.delete(q.id);
    expanded.delete(q.id);
    toast(r.data.bonusPucks > 0 ? `Ответ принят. +${r.data.bonusPucks} шайб в банк тура.` : "Ответ принят.");
    if (r.data.bonusPucks > 0) {
      const p = S.me.pucks;
      if (p) { p.granted += r.data.bonusPucks; p.left += r.data.bonusPucks; }
      const bal = document.getElementById("bal");
      if (bal && p) bal.textContent = String(p.left);
    }
    load();
  }

  /** Строка под вопросом в свёрнутом виде. */
  function summary(q) {
    const mineOpt = q.options.find((o) => o.mine);
    if (q.status === "resolved") {
      if (q.gained === null) return "Итог подведён";
      return q.gained > 0 ? `Угадали: +${q.gained} очков` : `Мимо${mineOpt ? `: вы выбрали ${teamName(mineOpt.name, lg.birthYear)}` : ""}`;
    }
    if (q.myPick !== null && mineOpt) {
      const same = mineOpt.share ?? 0;
      return `Вы: ${teamName(mineOpt.name, lg.birthYear)} · так же ответили ${same}%${q.status === "closed" ? " · приём закрыт" : ""}`;
    }
    if (q.status === "closed") return "Приём закрыт";
    return q.bonusPucks > 0 ? `+${q.bonusPucks} шайб за ответ · до ${when(q.closesAt)}` : `до ${when(q.closesAt)}`;
  }

  function options(q) {
    const choosing = q.status === "open" && (q.myPick === null || editing.has(q.id));
    const buttons = [];
    const rows = q.options.map((o) => {
      const name = teamName(o.name, lg.birthYear);
      if (choosing) {
        const b = h("button", { type: "button", class: "fopt", onclick: () => choose(q, o.teamId, buttons) },
          h("span", { class: "fn" }, name),
          h("span", { class: "fc" }, `оценка ${Math.round(o.chance)}%`),
          h("span", { class: "fp" }, `+${o.points}`));
        buttons.push(b);
        return b;
      }
      const bar = h("i", {});
      bar.style.setProperty("--w", String(o.share ?? 0));
      return h("div", { class: "frow" + (o.mine ? " mine" : "") + (o.correct === true ? " ok" : "") },
        h("div", { class: "ftop" },
          h("span", { class: "fn" }, (o.mine ? "✓ " : "") + name),
          h("span", { class: "fs" }, `${o.share ?? 0}%`)),
        h("div", { class: "fbar" }, bar),
        h("div", { class: "fsub" }, o.correct === true ? "верный ответ" : `оценка Табло ${Math.round(o.chance)}%`));
    });
    return { choosing, rows };
  }

  function card(q) {
    const isOpen = expanded.has(q.id);
    const head = h("button", { type: "button", class: "fhead", "aria-expanded": String(isOpen),
      onclick: () => { if (isOpen) { expanded.delete(q.id); editing.delete(q.id); } else expanded.add(q.id); draw(); } },
      h("span", { class: "ft" }, q.title),
      h("span", { class: "fchev", "aria-hidden": "true" }, isOpen ? "⌃" : "⌄"),
      h("span", { class: "fsum" }, summary(q)));
    if (!isOpen) return h("div", { class: "tile fq" }, head);
    const { choosing, rows } = options(q);
    return h("div", { class: "tile fq open" },
      head,
      q.subtitle ? h("p", { class: "note" }, q.subtitle) : null,
      h("div", { class: "fopts" }, rows),
      q.status === "open" && q.myPick !== null && !choosing
        ? h("button", { type: "button", class: "link", onclick: () => { editing.add(q.id); draw(); } }, "Изменить ответ") : null,
      h("p", { class: "note" }, q.status === "open" ? `Приём ответов до ${when(q.closesAt)}. Оценка Табло — по таблице и календарю, не гарантия.` : "Оценка Табло — по таблице и календарю, не гарантия."));
  }

  function draw() {
    // Главный вопрос над таблицей: первый без ответа, иначе первый в списке; остальные под таблицей
    const main = list.find((q) => q.status === "open" && q.myPick === null) ?? list[0];
    mount(top, main ? card(main) : null);
    mount(bottom, scope === "all" ? list.filter((q) => q !== main).map(card) : null);
  }

  load();
  return { top, bottom };
}
