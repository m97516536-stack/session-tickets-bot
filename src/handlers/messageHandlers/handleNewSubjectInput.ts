// src/handlers/messageHandlers/handleNewSubjectInput.ts
// Editing, Ticketing, Finished

import { MyContext } from "../../types.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { adminKeyboard_Ticketing } from "../../keyboards/keyboardAdminTicketing.js";
import { adminKeyboard_Editing } from "../../keyboards/keyboardAdminEditing.js";
import { adminKeyboard_Registration } from "../../keyboards/keyboardAdminRegistration.js";
import { fastCheckPhase } from "../../utils/updatePhase.js";
import { createNewSubjectFromSheet } from "../../storage/googleSheets.js";
import { InlineKeyboard } from "grammy";

/**
 * Обрабатывает ввод названия нового предмета для загрузки из Google Таблицы.
 * Вызывается когда админ находится в состоянии "awaiting_new_subject_name".
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleNewSubjectInput(ctx: MyContext): Promise<void> {
  if (ctx.message?.message_id && ctx.chat?.id) {
    await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
  }

  const subjectName = ctx.message?.text?.trim();
  
  if (!subjectName) {
    await ctx.reply("❌ Введите корректное название предмета.");
    return;
  }

  let keyboard: InlineKeyboard | undefined;
  const phase = await fastCheckPhase();
  if (phase === "registration") {
    keyboard = adminKeyboard_Registration();
  } else if (phase === "editing") {
    keyboard = adminKeyboard_Editing();
  } else if (phase === "ticketing" || phase === "finished") {
    keyboard = adminKeyboard_Ticketing(phase === "finished");
  } else {
    keyboard = undefined;
  }

  try {
    const resultText = await createNewSubjectFromSheet(subjectName);

    await manageKeyboard(
      ctx,
      resultText,
      keyboard,
      "admin",
      false
    );
  } catch (err) {
    console.error("Ошибка при создании нового предмета:", err);

    await manageKeyboard(
      ctx,
      `❌ Ошибка при создании предмета "${subjectName}".`,
      keyboard,
      "admin",
      false
    );
  } finally {
    delete ctx.session.admin.state;
  }
}