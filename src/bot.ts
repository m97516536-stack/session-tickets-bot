// src/bot.ts

import { Bot, session } from "grammy";
import { GrammyError, HttpError } from "grammy";

import { BOT_TOKEN, SESSIONS_FILE } from "./config.js";
import { MyContext, MySession } from "./types.js";

import { readJson, writeJson } from "./storage/jsonStorage.js";

import { commandStart } from "./commands/commandStart.js";
import { commandAdmin } from "./commands/commandAdmin.js";
import { commandInit } from "./commands/commandInit.js";

import { handleCallbackQuery } from "./handlers/callbackHandlers/callbackRouter.js";
import { handleMessage } from "./handlers/messageHandlers/messageRouter.js";


import { startPhaseUpdater } from "./utils/updatePhase.js";

export const bot = new Bot<MyContext>(BOT_TOKEN);

let initialSessions: Record<string, MySession> = await readJson<Record<string, MySession>>(SESSIONS_FILE);

bot.use(
  session({
    initial: () => ({ user: {}, admin: {} }),
    getSessionKey: (ctx) => String(ctx.from!.id),
    storage: {
      read: (key) => initialSessions[key] || { user: {}, admin: {} },
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

bot.command("start", commandStart);
bot.command("admin", commandAdmin);
bot.command("init", commandInit);

bot.on("message:text", async (ctx) => {
  await handleMessage(ctx);
});

bot.on("callback_query:data", async (ctx) => {
  await handleCallbackQuery(ctx);
});

console.log("🚀 Бот запущен!");
await startPhaseUpdater();
bot.start();

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Ошибка в запросе:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Не удалось связаться с Telegram:", e);
  } else {
    console.error("Неизвестная ошибка:", e);
  }
});
