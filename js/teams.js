import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { teamPicker } from "./teampicker.js";
import { S, paintHeader, toast } from "./state.js";
import { remindToggle } from "./remind.js";

/** «Мои команды»: изменить набор своих команд после регистрации. Пустой набор — режим «только слежу». */
export function renderTeams(root) {
  const selected = new Map((S.me.teams || []).map((t) => [t.id, { id: t.id, name: t.name, leagueId: t.leagueId }]));
  const save = h("button", { type: "button", class: "cta" }, "Сохранить");
  save.addEventListener("click", async () => {
    save.disabled = true;
    const r = await api("/api/me", { body: { teamIds: [...selected.keys()] } });
    save.disabled = false;
    if (!r.ok) return toast((r.data && r.data.message) || "Не получилось сохранить.", true);
    S.me = r.data;
    const leagueIds = r.data.teams.map((t) => t.leagueId);
    if (leagueIds.length && !leagueIds.includes(S.leagueId)) S.leagueId = leagueIds[0];
    paintHeader();
    toast(r.data.teams.length ? "Команды сохранены." : "Сохранено. Вы следите за матчами без своей команды.");
    S.go("home");
  });

  mount(root, h("section", { class: "screen" },
    h("button", { type: "button", class: "cta ghost small back", onclick: () => S.go("home") }, "← Назад"),
    h("h1", { class: "h1" }, "Мои команды"),
    h("p", { class: "lede" }, "Трибуна и рейтинг строятся по группам ваших команд. Без команд вы следите за матчами и играете, но трибуна закрыта."),
    teamPicker({ selected, onChange: () => {} }),
    remindToggle(),
    save));
}
