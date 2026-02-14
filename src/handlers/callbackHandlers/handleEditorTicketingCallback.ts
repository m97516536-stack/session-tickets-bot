// src/handlers/callbackHandlers/handleEditorTicketingCallback.ts

import { MyContext, UserRecord } from "../../types.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { sendEditorTicketMessage, resetEditorTicketTimer, deleteEditorTicketMessage } from "../../utils/editorMessageManager.js";
import { updateTicketStatusInSheet } from "../../storage/googleSheets.js";
import { getEditorTicketsText, keyboardEditorSelectTicket, buildEditorTicketCaption, keyboardEditorTicketReview, keyboardEditorTicketReplaceOnly } from "../../keyboards/keyboardEditorTicketing.js";
import { AllSubjectsData } from "../../types.js";

/**
 * Обрабатывает действия редактора: выбор билета и действия над ним.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleEditorTicketingCallback(ctx: MyContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!ctx.from || !ctx.chat) return;

  const editorId = ctx.from.id;

  if (data?.startsWith("edit_ticket_")) {
    await ctx.answerCallbackQuery();

    const parts = data.split("_");
    if (parts.length < 4) return;

    const subject = parts.slice(2, -1).join("_");
    const ticketNumber = parseInt(parts[parts.length - 1], 10);
    if (isNaN(ticketNumber)) return;

    const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
    const subjectData = subjectsData[subject];
    if (!subjectData || !Array.isArray(subjectData)) return;

    const question = subjectData.find(q => q.number === ticketNumber);
    if (!question) return;

    const caption = await buildEditorTicketCaption(subject, ticketNumber);
    const keyboard = 
      question.status === "approved"
        ? keyboardEditorTicketReplaceOnly(subject, ticketNumber)
        : keyboardEditorTicketReview(subject, ticketNumber);

    await sendEditorTicketMessage(
      ctx.api,
      editorId,
      ctx.chat.id,
      subject,
      ticketNumber,
      caption,
      keyboard
    );

    return;
  }

  if (data?.startsWith("review_")) {
    await ctx.answerCallbackQuery();

    const parts = data.split("_");
    if (parts.length < 4) return;

    const action = parts[parts.length - 1];
    const ticketNumber = parseInt(parts[parts.length - 2], 10);
    const subject = parts.slice(1, -2).join("_");
    if (isNaN(ticketNumber)) return;

    const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
    const subjectData = subjectsData[subject];
    if (!subjectData || !Array.isArray(subjectData)) return;

    const question = subjectData.find(q => q.number === ticketNumber);
    if (!question || !question.assignedTo) return;

    const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    const student = users[String(question.assignedTo)];

    if (action === "approve") {
      await deleteEditorTicketMessage(ctx.api, editorId, subject, ticketNumber);

      question.status = "approved";
      await writeJson(SUBJECTS_DATA_FILE, subjectsData);
      await updateTicketStatusInSheet(subject, ticketNumber, "approved");

      if (student) {
        try {
          await ctx.api.sendMessage(
            question.assignedTo,
            `✅ Ваш билет по предмету "${subject}" (№${ticketNumber}) принят!`
          );
        } catch (e) {
          console.warn(`Не удалось уведомить студента ${question.assignedTo}:`, e);
        }
      }

      const editor = users[String(editorId)];
      if (editor?.editor) {
        const newText = await getEditorTicketsText(editor);
        const newKeyboard = await keyboardEditorSelectTicket(editor);
        await manageKeyboard(
          ctx,
          newText,
          newKeyboard,
          "editor",
          false
        );
      }

    } else if (action === "revise") {
      await deleteEditorTicketMessage(ctx.api, editorId, subject, ticketNumber);

      ctx.session.editor = {
        awaitingRevisionComment: { subject, ticketNumber },
        chatId: ctx.chat.id,
      };

      const sent = await ctx.reply("✏️ Введите комментарий для студента:");
      ctx.session.editor.promptMessageId = sent.message_id;

    } else if (action === "replace") {
      await resetEditorTicketTimer(editorId, subject, ticketNumber);

      ctx.session.editor = {
        awaitingReplacementFile: { subject, ticketNumber },
        chatId: ctx.chat.id,
      };

      const sent = await ctx.reply("📤 Отправьте новый файл:");
      ctx.session.editor.promptMessageId = sent.message_id;
    }

    return;
  }

  if (data === "reboot_editor_menu") {
    await ctx.answerCallbackQuery();

    delete ctx.session.editor.awaitingReplacementFile;
    delete ctx.session.editor.awaitingRevisionComment;
    delete ctx.session.editor.chatId;
    delete ctx.session.editor.promptMessageId;

    const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    const editor = users[String(editorId)];
    if (!editor?.editor) return;

    const text = await getEditorTicketsText(editor);
    const keyboard = await keyboardEditorSelectTicket(editor);

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "editor",
      false
    );
    return;
  }

  if (data === "noop") {
    await ctx.answerCallbackQuery();
    return;
  }
}