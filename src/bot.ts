// src/bot.ts

import { Bot, session } from "grammy";
import { GrammyError, HttpError } from "grammy";

import { BOT_TOKEN, SESSIONS_FILE } from "./config.js";
import { MyContext, MySession } from "./types.js";

import { readJson, writeJson } from "./storage/jsonStorage.js";

import { commandUser } from "./commands/commandUser.js";
import { commandAdmin } from "./commands/commandAdmin.js";
import { commandEditor } from "./commands/commandEditor.js";

import { handleCallbackQuery } from "./handlers/callbackHandlers/callbackRouter.js";
import { handleMessage } from "./handlers/messageHandlers/messageRouter.js";

import { startPhaseUpdater } from "./utils/updatePhase.js";
import { cleanupExpiredEditorMessages } from "./utils/editorMessageManager.js";
import { startKeyboardCleanup } from "./utils/manageKeyboard.js";

/**
 * Инициализирует и запускает Telegram-бота.
 * 
 * @exports
 * - bot: Bot<MyContext> — экземпляр бота, доступен в других модулях
 * 
 * @returns {void}
 */

export const bot = new Bot<MyContext>(BOT_TOKEN);

let initialSessions: Record<string, MySession> = await readJson<Record<string, MySession>>(SESSIONS_FILE);

bot.use(
  session({
    initial: () => ({ user: {}, admin: {}, editor: {} }),
    getSessionKey: (ctx) => String(ctx.from!.id),
    storage: {
      read: (key) => initialSessions[key] || { user: {}, admin: {}, editor: {} },
      write: async (key, value) => {
        initialSessions[key] = value;
        await writeJson(SESSIONS_FILE, initialSessions);
      },
      delete: async (key) => {
        delete initialSessions[key];
        await writeJson(SESSIONS_FILE, initialSessions);
      },
    },
  })
);

bot.command("user", commandUser);
bot.command("admin", commandAdmin);
bot.command("editor", commandEditor);

bot.on("message", async (ctx) => {
  await handleMessage(ctx);
});

bot.on("callback_query:data", async (ctx) => {
  await handleCallbackQuery(ctx);
});

console.log("🚀 Бот запущен!");
await startPhaseUpdater();

await cleanupExpiredEditorMessages(bot.api);
console.log("🧹 Очистка просроченных сообщений редакторов выполнена");

const cleanupInterval = setInterval(() => {
  cleanupExpiredEditorMessages(bot.api).catch(err => {
    console.error("Ошибка при периодической очистке сообщений редакторов:", err);
  });
}, 30 * 60 * 1000);

startKeyboardCleanup(bot);

bot.start();

await bot.api.setMyCommands([
  { command: "user", description: "Регистрация / Меню пользователя" },
  { command: "editor", description: "Меню для редакторов" },
  { command: "admin", description: "Меню администратора" }
]);

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError && e.error_code === 400 && e.description?.includes("query is too old")) {
    console.warn("Ignored expired callback query");
    return;
  }
  if (e instanceof GrammyError) {
    if (e.error_code === 400 && e.description?.includes("query is too old")) {
      console.warn("Пропущен устаревший callback-запрос (пользователь слишком долго ждал ответа)");
      return;
    }
    console.error("Ошибка в запросе:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Не удалось связаться с Telegram:", e);
  } else {
    console.error("Неизвестная ошибка:", e);
  }
});

process.on("SIGINT", async () => {
  console.log("\n🛑 Получен сигнал завершения, останавливаем бота...");
  clearInterval(cleanupInterval);
  await bot.stop();
  console.log("✅ Бот остановлен");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Получен SIGTERM, останавливаем бота...");
  clearInterval(cleanupInterval);
  await bot.stop();
  console.log("✅ Бот остановлен");
  process.exit(0);
});