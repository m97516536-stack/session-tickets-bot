// src/handlers/callbackHandlers/handleEditorTicketReviewCallback.ts

import { MyContext } from "../../types.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { manageTicketMessage } from "../../utils/manageTicketMessage.js";
import { updateTicketStatusInSheet } from "../../storage/googleSheets.js";
import { UserRecord, AllSubjectsData } from "../../types.js";
import { buildTicketCaption } from "../../keyboards/keyboardEditorTicketReview.js";

/**
 * Обрабатывает действия проверяющего в темах супергруппы (принять/доработать/заменить файл).
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleEditorTicketReviewCallback(ctx: MyContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith("review_")) return;

  await ctx.answerCallbackQuery();

  const parts = data.split("_");
  if (parts.length < 4) return;

  const action = parts[parts.length - 1];
  const ticketNumber = parseInt(parts[parts.length - 2], 10);
  const subject = parts.slice(1, -2).join("_");

  if (isNaN(ticketNumber)) return;

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const subjectData = subjectsData[subject];
  if (!subjectData) return;

  const question = subjectData.questions.find(q => q.number === ticketNumber);
  if (!question || !question.assignedTo) return;

  if (action === "approve") {
    question.status = "approved";
    delete question.comment;
    delete question.editorComment;
    await writeJson(SUBJECTS_DATA_FILE, subjectsData);

    const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    const user = users[String(question.assignedTo)];
    const caption = user ? buildTicketCaption(subject, ticketNumber, user.fio) : "";

    await manageTicketMessage(ctx.api, subject, ticketNumber, caption);
    await updateTicketStatusInSheet(subject, ticketNumber, "approved");

  } else if (action === "revise") {
    ctx.session.editor = {
      awaitingRevisionComment: { subject, ticketNumber },
      chatId: ctx.chat?.id,
    };
    const sent = await ctx.reply("✏️ Введите комментарий для студента:");
    ctx.session.editor.promptMessageId = sent.message_id;

  } else if (action === "replace") {
    ctx.session.editor = {
      awaitingReplacementFile: { subject, ticketNumber },
      chatId: ctx.chat?.id,
    };
    const sent = await ctx.reply("📤 Отправьте новый файл:");
    ctx.session.editor.promptMessageId = sent.message_id;
  }
}