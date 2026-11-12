import { api, telegram } from "./api.js";
import { h, mount } from "./dom.js";
import { plural } from "./format.js";
import { S, toast } from "./state.js";

/** Приглашения: код, ссылка, «поделиться». Открывается плиткой «Позвать своих» на Табло и Трибуне. */
export async function renderInvite(root) {
  const me = S.me;
  mount(root, h("section", { class: "screen" }, h("p", { class: "empty" }, "Загружаем…")));
  const health = await api("/api/health");
  const bot = health.ok && health.data.bot ? health.data.bot : null;
  const app = health.ok && health.data.app ? health.data.app : null;
  const link = bot ? `https://t.me/${bot}${app ? "/" + app : ""}?startapp=${me.inviteCode}` : null;
  const n = me.invitedPlayed || 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link || me.inviteCode);
      toast("Скопировано.");
    } catch {
      toast("Не получилось скопировать. Выделите код вручную.", true);
    }
  };
  const share = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Играем в прогнозы по детскому хоккею. Заходи:")}`;
    if (telegram && telegram.openTelegramLink) telegram.openTelegramLink(url);
    else window.open(url, "_blank", "noopener");
  };

  mount(root, h("section", { class: "screen" },
    h("button", { type: "button", class: "cta ghost small back", onclick: () => S.go("home") }, "← Назад"),
    h("h1", { class: "h1" }, "Позвать своих"),
    h("p", { class: "lede" }, "Чем больше родителей вашей группы играет, тем интереснее трибуна и рейтинг."),
    h("div", { class: "tile" },
      h("div", {}, "За каждого, кто зайдёт по вашему коду и сам отыграет тур, ", h("b", {}, "+5 шайб"), " к банку каждого тура. Считается до 20 человек: банк вырастет со 100 до 200."),
      h("div", { class: "code" },
        h("input", { value: link || me.inviteCode, readOnly: true, "aria-label": "Код приглашения" }),
        h("button", { type: "button", class: "cta small", onclick: copy }, "Копировать")),
      link ? h("button", { type: "button", class: "cta", onclick: share }, "Поделиться в Телеграме") : null,
      h("p", { class: "note" }, `Отыграли по вашему коду: ${n} ${plural(n, "человек", "человека", "человек")}. Регистрации мало: шайбы начисляются, когда приглашённый сам сделает бросок, и идут, пока он продолжает играть.`)),
    h("button", { type: "button", class: "link", onclick: () => { S.rules = true; S.render(); } }, "Правила игры")));
}
