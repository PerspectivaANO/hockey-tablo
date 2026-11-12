/**
 * Сборка DOM без innerHTML: любой текст (имена команд, сообщения трибуны)
 * попадает на страницу только как textContent, поэтому внедрить разметку нельзя.
 */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    // Наша CSP запрещает встроенные стили: такой атрибут молча не сработал бы. Только классы.
    if (k === "style") throw new Error("style запрещён CSP, используйте class");
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked" || k === "disabled" || k === "hidden" || k === "readOnly") el[k] = !!v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export function mount(el, ...kids) {
  clear(el);
  append(el, kids);
}
