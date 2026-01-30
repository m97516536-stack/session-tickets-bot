// src/handlers/messageHandlers/handleEditorActions.ts

import { MyContext } from "../../types.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { manageTicketMessage } from "../../utils/manageTicketMessage.js";
import { updateTicketStatusInSheet } from "../../storage/googleSheets.js";
import { downloadAndSaveTicketFile } from "../../utils/fileManager.js";
import { UserRecord, AllSubjectsData } from "../../types.js";
import { buildTicketCaption, keyboardEditorTicketReview } from "../../keyboards/keyboardEditorTicketReview.js";

/**
 * Удаляет служебные сообщения.
 * @param {MyContext} ctx - контекст бота
 * @param {number | undefined} chatId - ID чата
 * @param {...(number | undefined)[]} messageIds - ID сообщений для удаления
 */
async function deleteMessages(ctx: MyContext, chatId: number | undefined, ...messageIds: (number | undefined)[]): Promise<void> {
  if (!chatId) return;
  for (const id of messageIds) {
    if (id) {
      try {
        await ctx.api.deleteMessage(chatId, id);
      } catch (e) {

      }
    }
  }
}

/**
 * Обрабатывает отправку комментария для доработки билета.
 * @param {MyContext} ctx - контекст бота
 * @param {string} subject - название предмета
 * @param {number} ticketNumber - номер билета
 * @param {string} reviewerComment - комментарий проверяющего
 * @returns {Promise<void>}
 */
export async function handleRevisionComment(
  ctx: MyContext,
  subject: string,
  ticketNumber: number,
  reviewerComment: string
): Promise<void> {
  const editor = ctx.session.editor;
  const chatId = editor?.chatId;
  const promptId = editor?.promptMessageId;
  await deleteMessages(ctx, chatId, promptId, ctx.message?.message_id);

  let subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const question = subjectsData[subject]?.questions.find(q => q.number === ticketNumber);
  if (!question || !question.assignedTo) {
    ctx.session.editor = {};
    return;
  }

  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const user = users[String(question.assignedTo)];

  question.status = "revision";
  question.editorComment = reviewerComment;
  await writeJson(SUBJECTS_DATA_FILE, subjectsData);

  const caption = buildTicketCaption(
    subject,
    ticketNumber,
    user?.fio || "Неизвестно",
    question.comment || "",
    reviewerComment
  );

  await manageTicketMessage(ctx.api, subject, ticketNumber, caption);
  await updateTicketStatusInSheet(subject, ticketNumber, "revision");

  try {
    await ctx.api.sendMessage(
      question.assignedTo,
      `🔔 Ваш билет по предмету "${subject}" (№${ticketNumber}) отправлен на доработку.\nКомментарий: ${reviewerComment}`
    );
  } catch (e) {
    console.warn("Не удалось уведомить студента:", e);
  }

  ctx.session.editor = {};
}

/**
 * Обрабатывает замену файла билета (новая версия).
 * @param {MyContext} ctx - контекст бота
 * @param {string} subject - название предмета
 * @param {number} ticketNumber - номер билета
 * @param {string} newFileId - ID нового файла в Telegram
 * @returns {Promise<void>}
 */
export async function handleFileReplacement(
  ctx: MyContext,
  subject: string,
  ticketNumber: number,
  newFileId: string
): Promise<void> {
  const editor = ctx.session.editor;
  const chatId = editor?.chatId;
  const promptId = editor?.promptMessageId;
  await deleteMessages(ctx, chatId, promptId, ctx.message?.message_id);

  try {
    await downloadAndSaveTicketFile(ctx.api, newFileId, subject, ticketNumber);
  } catch (err) {
    console.error("Ошибка при сохранении нового файла:", err);
    await ctx.reply("❌ Не удалось сохранить файл.");
    ctx.session.editor = {};
    return;
  }

  let subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const question = subjectsData[subject]?.questions.find(q => q.number === ticketNumber);
  if (!question || !question.assignedTo) {
    ctx.session.editor = {};
    return;
  }

  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const user = users[String(question.assignedTo)];

  const caption = buildTicketCaption(
    subject,
    ticketNumber,
    user?.fio || "Неизвестно",
    question.comment || "",
    question.editorComment || ""
  );

  await manageTicketMessage(
    ctx.api,
    subject,
    ticketNumber,
    caption,
    keyboardEditorTicketReview(subject, ticketNumber)
  );

  ctx.session.editor = {};
}