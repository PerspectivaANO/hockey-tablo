import { api } from "./api.js";
import { h, mount } from "./dom.js";
import { teamName } from "./format.js";
import { SOURCE_NAME } from "./labels.js";
import { leaguePicker, leagueHead } from "./picker.js";
import { S, league } from "./state.js";
import { zoneOf } from "./zones.js";
import { forecastBlock } from "./forecast.js";

let seq = 0;

const ZONE_NAMES = [["up", "подъём"], ["qu", "«Золотая шайба»"], ["po", "плей-офф"], ["pl", "переходные"], ["down", "спуск"]];

export async function renderTable(root) {
  const lg = league();
  const my = ++seq;
  const body = h("div", {}, h("p", { class: "empty" }, "Загружаем таблицу…"));
  mount(root, h("section", { class: "screen" },
    leaguePicker({ onChange: () => renderTable(root) }), leagueHead(lg), body));
  if (!lg) return mount(body, h("p", { class: "empty" }, "Группы ещё не загружены."));
  const r = await api(`/api/teams?leagueId=${lg.id}`);
  if (my !== seq) return;
  if (!r.ok) return mount(body, h("p", { class: "empty" }, "Не удалось загрузить таблицу."));
  const five = lg.format === "5x5";
  const cols = five
    ? [["И", "games"], ["В", "wins"], ["ВО/ВБ", "winsOt"], ["П", "losses"], ["ПО/ПБ", "lossesOt"], ["Ш", null], ["О", "points"]]
    : [["И", "games"], ["В", "wins"], ["Н", "draws"], ["П", "losses"], ["Ш", null], ["О", "points"]];
  const mine = new Set(((S.me && S.me.teams) || []).map((t) => t.id));
  const z = r.data.zones;
  const used = new Set(r.data.teams.map((_, i) => zoneOf(z, i + 1)));
  const fq = forecastBlock(lg);
  mount(body,
    fq.top,
    h("div", { class: "tscroll" }, h("table", {},
      h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", { class: "nm" }, "Команда"), cols.map(([t]) => h("th", {}, t)))),
      h("tbody", {}, r.data.teams.map((t, i) => h("tr", { class: mine.has(t.id) ? "me" : "", "data-z": zoneOf(z, i + 1) || null },
        h("td", {}, i + 1),
        h("td", { class: "nm" }, t.games === 0 ? `${teamName(t.name, lg.birthYear)} (ещё не играли)` : teamName(t.name, lg.birthYear)),
        cols.map(([, k]) => h("td", {}, k === null ? `${t.goalsFor}–${t.goalsAgainst}` : t[k])))))),
    ),
    z ? h("div", { class: "zleg" }, ZONE_NAMES.filter(([k]) => used.has(k)).map(([k, t]) => h("span", {}, h("i", { class: "zc " + k }), t))) : null,
    z ? h("p", { class: "tlegend" }, `${z.comp}. ${z.legend}`) : h("p", { class: "tlegend" }, "Зоны этой группы появятся, когда будут загружены из регламента."),
    h("p", { class: "tlegend" }, five
      ? "Очки: победа 2, победа в овертайме или по буллитам 2, поражение в овертайме или по буллитам 1."
      : "Очки: победа 2, ничья 1, поражение 0. Овертайма и буллитов в 4х4 нет."),
    h("p", { class: "tlegend" }, `Таблица считается по данным ${SOURCE_NAME[lg.federation || "fhm"] || "федерации"} и обновляется после каждого сыгранного матча.`),
    fq.bottom);
}
