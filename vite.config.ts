import { defineConfig } from 'vite';

// Конфиг сборщика Vite.
// Пока минимально: корень проекта, папка public для ассетов,
// сервер для локальной проверки. Под Yandex Games правим позже (Этап 4).
export default defineConfig({
  publicDir: 'public',
  // Относительные пути: игра лежит в подпапке (/igruha/ на GitHub Pages,
  // свой путь в iframe Яндекса) — ассеты резолвятся от index.html везде.
  base: './',
  server: {
    port: 5173,
  },
  build: {
    // Держим ZIP маленьким для Yandex Games (лимит 100 МБ, цель — до 50 МБ).
    chunkSizeWarningLimit: 1000,
  },
});
