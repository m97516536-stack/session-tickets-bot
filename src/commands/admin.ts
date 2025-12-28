import { MyContext, SubjectConfig } from "../types.js";
import { ADMIN_ID, SUBJECT_CONFIG_FILE } from "../config.js";
import { readJson } from "../storage/jsonStorage.js";
import { buildAdminKeyboard, buildAdminText } from "../keyboards/keyboardAdmin.js";

export async function commandAdmin(ctx: MyContext): Promise<void> {
  if (ctx.chat?.type !== "private") return;
  if (ctx.from?.id !== ADMIN_ID) return;

  const keyboard = buildAdminKeyboard(ctx);
  const messageText = buildAdminText(ctx);

  const adminSession = ctx.session.admin || {};

  const oldMessageId = adminSession.lastAdminMessageId;

  // Если у нас есть старое сообщение — удалим его
  if (oldMessageId) {
    try {
      await ctx.api.deleteMessage(ctx.from.id, oldMessageId);
    } catch (e) {
      // Если сообщение уже удалено — не страшно
    }
  }

  // Отправим новое сообщение и сохраним его ID
  const sent = await ctx.reply(messageText, { reply_markup: keyboard });
  ctx.session.admin = {
    ...adminSession,
    lastAdminMessageId: sent.message_id,
  };
}

/*
export async function commandAdmin(ctx: MyContext): Promise<void> {
  if (ctx.chat?.type !== "private") return;
  if (ctx.from?.id !== ADMIN_ID) return;

  const keyboard = buildAdminKeyboard(ctx);
  const messageText = buildAdminText(ctx);

  const adminSession = ctx.session.admin || {};

  let messageId = adminSession.lastAdminMessageId;

  try {
    if (messageId) {
      await ctx.api.editMessageText(ctx.from.id, messageId, messageText, {
        reply_markup: keyboard,
      });
    } else {
      const sent = await ctx.reply(messageText, { reply_markup: keyboard });
      ctx.session.admin = {
        ...adminSession,
        lastAdminMessageId: sent.message_id,
      };
    }
  } catch (e) {
    // Сообщение удалено или не найдено — отправим новое
    const sent = await ctx.reply(messageText, { reply_markup: keyboard });
    ctx.session.admin = {
      ...adminSession,
      lastAdminMessageId: sent.message_id,
    };
  }
}
*/

export async function commandInit(ctx: MyContext): Promise<void> {
  if(ctx.from?.id !== ADMIN_ID) return;
  if(ctx.chat?.type !== "supergroup") return;
  const threadId = ctx.msg?.message_thread_id;
  if (!threadId) return;

  const subjectConfig = await readJson<SubjectConfig>(SUBJECT_CONFIG_FILE);
  if(subjectConfig[threadId]) return;

  await ctx.reply("✏️ Введите название листа в Google-таблице (оно должно совпадать с названием предмета):");
  ctx.session.user.state = "awaiting_subject_and_sheet";
  ctx.session.user.awaitingSubjectId = threadId;
}
