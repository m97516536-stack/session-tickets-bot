// src/handlers/messageHandlers/handleEditorTicketingActions.ts
// Ticketing, Finished

import { MyContext, UserRecord } from "../../types.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { downloadAndSaveTicketFile } from "../../utils/fileManager.js";
import { updateTicketStatusInSheet } from "../../storage/googleSheets.js";
import { sendEditorTicketMessage} from "../../utils/editorMessageManager.js";
import { getEditorTicketsText, keyboardEditorSelectTicket, buildEditorTicketCaption, keyboardEditorTicketReview, keyboardEditorTicketReplaceOnly } from "../../keyboards/keyboardEditorTicketing.js";
import { AllSubjectsData } from "../../types.js";
import { deleteMessages } from "../../utils/deleteMessages.js";

/**
 * Обрабатывает комментарий редактора для отправки билета на доработку.
 * @param ctx - контекст бота
 * @param subject - название предмета
 * @param ticketNumber - номер билета
 * @param reviewerComment - комментарий редактора
 */
async function handleRevisionComment(
  ctx: MyContext,
  subject: string,
  ticketNumber: number,
  reviewerComment: string
): Promise<void> {
  const editor = ctx.session.editor;
  const chatId = editor?.chatId;
  const promptId = editor?.promptMessageId;

  await deleteMessages(ctx.api, chatId, promptId, ctx.message?.message_id);

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const subjectData = subjectsData[subject];
  if (!subjectData || !Array.isArray(subjectData)) return;

  const question = subjectData.find(q => q.number === ticketNumber);
  if (!question || !question.assignedTo) return;

  question.status = "revision";
  question.editorComment = reviewerComment;
  await writeJson(SUBJECTS_DATA_FILE, subjectsData);
  await updateTicketStatusInSheet(subject, ticketNumber, "revision");

  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const student = users[String(question.assignedTo)];
  if (student) {
    try {
      await ctx.api.sendMessage(
        question.assignedTo,
        `🔄 Ваш билет по предмету "${subject}" (№${ticketNumber}) отправлен на доработку.\nКомментарий: ${reviewerComment}`
      );
    } catch (e) {
      console.warn(`Не удалось уведомить студента ${question.assignedTo}:`, e);
    }
  }

  const editorUser = users[String(ctx.from!.id)];
  if (editorUser?.editor) {
    const newText = await getEditorTicketsText(editorUser);
    const newKeyboard = await keyboardEditorSelectTicket(editorUser);
    await manageKeyboard(
      ctx,
      newText,
      newKeyboard,
      "editor",
      false
    );
  }

  ctx.session.editor = {};
}

/**
 * Обрабатывает замену файла билета.
 * @param ctx - контекст бота
 * @param subject - название предмета
 * @param ticketNumber - номер билета
 * @param newFileId - ID нового файла в Telegram
 */
async function handleFileReplacement(
  ctx: MyContext,
  subject: string,
  ticketNumber: number,
  newFileId: string
): Promise<void> {
  const editor = ctx.session.editor;
  const chatId = editor?.chatId;
  const promptId = editor?.promptMessageId;

  await deleteMessages(ctx.api, chatId, promptId, ctx.message?.message_id);

  try {
    await downloadAndSaveTicketFile(ctx.api, newFileId, subject, ticketNumber);
  } catch (err) {
    console.error("Ошибка при сохранении нового файла:", err);
    await ctx.reply("❌ Не удалось сохранить файл.");
    ctx.session.editor = {};
    return;
  }

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const subjectData = subjectsData[subject];
  const question = subjectData?.find(q => q.number === ticketNumber);

  const caption = await buildEditorTicketCaption(subject, ticketNumber);
  const keyboard = 
    question?.status === "approved"
      ? keyboardEditorTicketReplaceOnly(subject, ticketNumber)
      : keyboardEditorTicketReview(subject, ticketNumber);

  await sendEditorTicketMessage(
    ctx.api,
    ctx.from!.id,
    ctx.chat!.id,
    subject,
    ticketNumber,
    caption,
    keyboard
  );

  ctx.session.editor = {};
}

/**
 * Обрабатывает сообщения редактора (комментарии и файлы).
 * @param ctx - контекст бота
 */
export async function handleEditorTicketingActions(ctx: MyContext): Promise<void> {
  if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") return;

  const editorSession = ctx.session.editor;

  if (editorSession?.awaitingRevisionComment && ctx.message?.text) {
    const { subject, ticketNumber } = editorSession.awaitingRevisionComment;
    await handleRevisionComment(ctx, subject, ticketNumber, ctx.message.text.trim());
    return;
  }

  if (editorSession?.awaitingReplacementFile && ctx.message?.document) {
    const { subject, ticketNumber } = editorSession.awaitingReplacementFile;
    await handleFileReplacement(ctx, subject, ticketNumber, ctx.message.document.file_id);
    return;
  }
}