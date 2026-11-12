/* Ждёт, пока tg-loader.js подключит скрипт Телеграма (внутри Телеграма). Импортируется первым в api.js. */
await window.__tgReady;
export {};
