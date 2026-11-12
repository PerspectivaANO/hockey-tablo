import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { teamName } from "./format.js";
import { ageLabel, federationTag, leaguePicker } from "./picker.js";
import { S, toast } from "./state.js";

export const MAX_TEAMS = 6;

/** Подпись выбранной команды: «Русь · 2014, Группа А» — одинаково названные команды в разных группах не путаются. */
export function teamLabel(t) {
  const lg = S.leagues.find((l) => l.id === t.leagueId);
  return lg ? `${teamName(t.name, lg.birthYear)} · ${[federationTag(lg), ageLabel(lg), lg.code === "ALL" ? "" : lg.groupTitle].filter(Boolean).join(", ")}` : t.name;
}

/**
 * Выбор своих команд: сверху возраст и группа, ниже галочки у команд. Выбор сохраняется при
 * переходе между группами, поэтому можно отметить команды разных возрастов. Пустой выбор допустим:
 * человек просто следит за матчами. `selected` — Map id → {id, name, leagueId}, его правит сам выбор.
 */
export function teamPicker({ selected, onChange }) {
  const box = h("div", {});
  const chosen = h("div", {});
  const pickerBox = h("div", {});
  const teamsBox = h("div", {});
  let loadedFor = null;
  let teams = [];

  const drawChosen = () => mount(chosen,
    h("p", { class: "stitle" }, h("span", {}, "Мои команды"), h("span", {}, `${selected.size} из ${MAX_TEAMS}`)),
    selected.size === 0
      ? h("p", { class: "note" }, "Пока никого. Можно никого не выбирать: тогда вы просто следите за матчами и играете без своей команды.")
      : h("div", { class: "selchips" }, [...selected.values()].map((t) =>
          h("button", { type: "button", class: "selchip", "aria-label": `Убрать: ${teamLabel(t)}`,
            onclick: () => { selected.delete(t.id); drawChosen(); drawTeams(); onChange(); } }, `${teamLabel(t)}  ✕`))));

  function drawTeams() {
    const lg = S.leagues.find((l) => l.id === S.leagueId);
    mount(teamsBox, teams.length === 0
      ? h("p", { class: "empty" }, "В этой группе пока нет команд.")
      : h("div", { class: "tile" }, teams.map((t) => h("label", { class: "check" },
          h("input", { type: "checkbox", checked: selected.has(t.id),
            onchange: (e) => {
              if (e.target.checked) {
                if (selected.size >= MAX_TEAMS) { e.target.checked = false; return toast(`Можно выбрать не больше ${MAX_TEAMS} команд.`, true); }
                selected.set(t.id, { id: t.id, name: t.name, leagueId: S.leagueId });
              } else selected.delete(t.id);
              drawChosen();
              onChange();
            } }),
          h("span", {}, lg ? teamName(t.name, lg.birthYear) : t.name)))));
  }

  async function loadTeams() {
    if (!S.leagueId) return;
    if (loadedFor !== S.leagueId) {
      mount(teamsBox, h("p", { class: "empty" }, "Загружаем команды…"));
      const r = await api(`/api/teams?leagueId=${S.leagueId}`);
      teams = r.ok ? r.data.teams : [];
      loadedFor = S.leagueId;
    }
    drawTeams();
  }

  function drawPicker() {
    mount(pickerBox, leaguePicker({ onChange: () => { drawPicker(); void loadTeams(); } }));
  }

  mount(box, chosen, pickerBox, teamsBox);
  drawChosen();
  drawPicker();
  void loadTeams();
  return box;
}
