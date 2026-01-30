// src/handlers/messageHandlers/handleTicketSubmission.ts

import { MyContext } from "../../types.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { getUserTicketsText, userKeyboard_Ticketing } from "../../keyboards/keyboardUserTicketing.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { manageTicketMessage } from "../../utils/manageTicketMessage.js";
import { updateTicketStatusInSheet } from "../../storage/googleSheets.js";
import { downloadAndSaveTicketFile } from "../../utils/fileManager.js";
import { UserRecord, AllSubjectsData } from "../../types.js";
import { buildTicketCaption } from "../../keyboards/keyboardEditorTicketReview.js";
import { keyboardEditorTicketReview } from "../../keyboards/keyboardEditorTicketReview.js";

/**
 * Обрабатывает отправку файла с решением билета от студента.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleTicketSubmission(ctx: MyContext): Promise<void> {
  if (!ctx.from || !ctx.message?.document) return;

  const userId = String(ctx.from.id);
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const user = users[userId];

  if (!user) {
    await ctx.reply("❌ Пользователь не найден.");
    return;
  }

  const awaiting = ctx.session.user.awaitingTicketSubmission;
  if (!awaiting) return;

  const { subject, ticketNumber } = awaiting;

  let subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const subjectData = subjectsData[subject];
  if (!subjectData) {
    await ctx.reply(`❌ Предмет "${subject}" не найден.`);
    delete ctx.session.user.awaitingTicketSubmission;
    return;
  }

  const question = subjectData.questions.find(q => q.number === ticketNumber);
  if (!question) {
    await ctx.reply(`❌ Вопрос №${ticketNumber} не найден в предмете "${subject}".`);
    delete ctx.session.user.awaitingTicketSubmission;
    return;
  }

  if (question.status !== "not_submitted" && question.status !== "revision") {
    await ctx.reply("❌ Этот билет уже находится на проверке.");
    delete ctx.session.user.awaitingTicketSubmission;
    return;
  }

  const fileId = ctx.message.document.file_id;
  const studentComment = ctx.message.caption || "";

  try {
    await downloadAndSaveTicketFile(ctx.api, fileId, subject, ticketNumber);
  } catch (err) {
    console.error("Ошибка при сохранении файла:", err);
    await ctx.reply("❌ Не удалось сохранить файл. Попробуйте позже.");
    delete ctx.session.user.awaitingTicketSubmission;
    return;
  }

  subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const freshQuestion = subjectsData[subject]?.questions.find(q => q.number === ticketNumber);
  if (!freshQuestion) {
    await ctx.reply("❌ Ошибка: билет исчез после сохранения файла.");
    delete ctx.session.user.awaitingTicketSubmission;
    return;
  }

  freshQuestion.status = "pending";
  freshQuestion.comment = studentComment;
  await writeJson(SUBJECTS_DATA_FILE, subjectsData);

  const caption = buildTicketCaption(subject, ticketNumber, user.fio, studentComment);

  try {
    await manageTicketMessage(
      ctx.api,
      subject,
      ticketNumber,
      caption,
      keyboardEditorTicketReview(subject, ticketNumber)
    );

    await updateTicketStatusInSheet(subject, ticketNumber, "pending");

    const text = await getUserTicketsText(user);
    await manageKeyboard(
      ctx,
      text + "\n\n✅ Файл успешно отправлен на проверку!",
      userKeyboard_Ticketing(),
      "user",
      true
    );

  } catch (err) {
    console.error("Ошибка при отправке билета:", err);
    await ctx.reply("❌ Не удалось отправить файл. Попробуйте позже.");

    subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
    const q = subjectsData[subject]?.questions.find(q => q.number === ticketNumber);
    if (q) {
      q.status = "not_submitted";
      delete q.comment;
      await writeJson(SUBJECTS_DATA_FILE, subjectsData);
    }
  }

  delete ctx.session.user.awaitingTicketSubmission;
}