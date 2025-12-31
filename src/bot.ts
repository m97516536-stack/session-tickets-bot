// src/bot.ts

import { Bot, session } from "grammy";
import { GrammyError, HttpError } from "grammy";

import { BOT_TOKEN, SESSIONS_FILE } from "./config.js";
import { MyContext, MySession } from "./types.js";

import { readJson, writeJson } from "./storage/jsonStorage.js";

import { commandAdmin } from "./commands/commandAdmin.js";
import { commandInit } from "./commands/commandInit.js";

import { handleSubjectInput } from "./handlers/handleSubjectInput.js";
import { handleAdminCallback } from "./handlers/handleAdminCallback.js";
import { handleDateInput } from "./handlers/handleDateInput.js";

import { startPhaseUpdater } from "./utils/updatePhase.js";

const bot = new Bot<MyContext>(BOT_TOKEN);

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

bot.command("admin", commandAdmin);
bot.command("init", commandInit);
// bot.command("start", commandStart);

bot.on("message:text", (ctx: MyContext) => {
  if (ctx.session.admin.state === "awaiting_subject_name" && ctx.chat?.type === "supergroup") {
    handleSubjectInput(ctx);
    return;
  }

  if (ctx.session.admin.state?.startsWith("awaiting_")) {
    handleDateInput(ctx);
    return;
  }

  return;
});

bot.on("callback_query:data", (ctx: MyContext) => {
  handleAdminCallback(ctx);
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
