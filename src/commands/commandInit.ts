// src/commands/commandInit.ts

import { MyContext } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { ADMIN_ID } from "../config.js";

export async function commandInit(ctx: MyContext) {
  if (ctx.session.admin.currentPhase !== undefined) {
    delete ctx.session.admin.state;
    return;
  }
  if (ctx.chat?.type !== "supergroup") return;
  if (ctx.from?.id !== ADMIN_ID) return;

  const threadId = ctx.msg?.message_thread_id;

  if (!threadId) {
    await ctx.reply("❌ Не удалось получить ID темы. Команда работает только в темах супергруппы.");
    return;
  }

  ctx.session.admin.state = "awaiting_subject_name";
  ctx.session.admin.awaitingSubjectThreadId = threadId;

  await manageKeyboard(
    ctx,
    "Введите название листа в Google Таблицах (название предмета):",
    undefined,
    "init",
    true
  );
}