import { Bot, session } from "grammy";
import { GrammyError, HttpError } from "grammy";

import { SESSIONS_FILE, BOT_TOKEN, ADMIN_ID } from "./config.js";
import { MyContext } from "./types.js";

import { readJson, writeJson } from "./storage/jsonStorage.js";

import { commandStart } from "./commands/start.js";
import { commandAdmin, commandInit } from "./commands/admin.js";

import { handleFioInput } from "./handlers/handlerFioInput.js";
import { handlerSubjectAnSsheetInput } from "./handlers/handlerSubjectAnSsheetInput.js"
import { handleSubjectSelection } from "./handlers/handleSubjectSelection.js";
import { handleAdminDeadlineInput } from "./handlers/handleAdminDeadlineInput.js";

let initialSessions = await readJson<Record<string, { user: any }>>(SESSIONS_FILE);

const bot = new Bot<MyContext>(BOT_TOKEN);

bot.use(
  session({
    initial: () => ({ user: {}, admin: {} }), // ✅
    getSessionKey: (ctx) => (ctx.from?.id ? String(ctx.from.id) : undefined),
    storage: {
      read: (key) => {
        const sessionData = initialSessions[key];
        if (sessionData) {
          return sessionData; // ✅ теперь возвращаем всё: user + admin
        }
        return { user: {}, admin: {} }; // ✅
      },
      write: async (key, value) => {
        initialSessions[key] = value; // ✅ сохраняем всё: user + admin
        await writeJson(SESSIONS_FILE, initialSessions);
      },
      delete: async (key) => {
        delete initialSessions[key];
        await writeJson(SESSIONS_FILE, initialSessions);
      },
    },
  })
)
/*
bot.use(
  session({
    initial: () => ({ user: {} }),
    getSessionKey: (ctx) => (ctx.from?.id ? String(ctx.from.id) : undefined),
    storage: {
      read: (key) => initialSessions[key]?.user ? { user: initialSessions[key].user } : { user: {} },
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
*/

bot.command("start", commandStart);
bot.command("admin", commandAdmin);
bot.command("init", commandInit);

bot.on("message:text", async (ctx) => {
  const text = ctx.msg?.text;
  if (text?.startsWith("/")) return;

  if (ctx.chat?.type == "private") {
    if (ctx.from?.id === ADMIN_ID && ctx.session.admin?.state === "awaiting_deadline_start") {
      await handleAdminDeadlineInput(ctx);
      return;
    }

    if (ctx.session.user.state === "awaiting_fio") {
      await handleFioInput(ctx);
    }
  }

  if(ctx.chat?.type == "supergroup") {
    if (ctx.from?.id !== ADMIN_ID) return;
    if (ctx.session.user.state == "awaiting_subject_and_sheet") {
      await handlerSubjectAnSsheetInput(ctx);
    }
  }
});

bot.on("callback_query:data", async (ctx) => {
  if (ctx.chat?.type !== "private") return;

  const data = ctx.callbackQuery.data;

  if (ctx.from?.id == ADMIN_ID) {
    if (data === "admin:new_cycle") {
      ctx.session.admin = {
        ...ctx.session.admin,
        state: "awaiting_deadline_start",
      };
      await ctx.answerCallbackQuery();
      // Обновим админ-сообщение с инструкцией
      await commandAdmin(ctx);
      return;
    }

    if (data === "admin:view_deadlines") {
      await ctx.answerCallbackQuery();
      await commandAdmin(ctx);
      return;
    }
  }

  // Только если пользователь в состоянии выбора предметов
  if (ctx.session.user.state === "awaiting_subject_selection") {
    await handleSubjectSelection(ctx);
  } else {
    // Можно игнорировать или обрабатывать другие кнопки позже
    await ctx.answerCallbackQuery("❌ Эта кнопка больше не активна.");
  }
});


console.log("🚀 Бот запущен!");
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
