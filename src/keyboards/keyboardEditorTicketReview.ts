// src/keyboards/keyboardEditorTicketReview.ts

import { InlineKeyboard } from "grammy";

/**
 * Клавиатура для биелтов в суппер группе.
 * @param {string} subject - название предмета
 * @param {number} ticketNumber - номер билета
 * @returns {InlineKeyboard}
 */
export function keyboardEditorTicketReview(subject: string, ticketNumber: number): InlineKeyboard {
  const base = `review_${subject}_${ticketNumber}`;
  return new InlineKeyboard()
    .text("✅ Принять", `${base}_approve`)
    .text("🔄 На доработку", `${base}_revise`)
    .row()
    .text("📤 Заменить файл", `${base}_replace`);
}

/**
 * Формирует подпись к сообщению с билетом.
 * @param {string} subject - название предмета
 * @param {number} ticketNumber - номер билета
 * @param {string} userName - имя студента
 * @param {string} [studentComment] - комментарий студента (опционально)
 * @param {string} [reviewerComment] - комментарий проверяющего (опционально)
 * @returns {string} готовая подпись
 */
export function buildTicketCaption(
  subject: string,
  ticketNumber: number,
  userName: string,
  studentComment: string = "",
  reviewerComment: string = ""
): string {
  const subjectTag = subject.replace(/\s+/g, "");
  const lines = [
    `#билет #${subjectTag} #Вопрос${ticketNumber}`,
    `👤 ${userName}`,
    ""
  ];

  if (studentComment.trim()) {
    lines.push(studentComment.trim());
    lines.push("");
  }

  if (reviewerComment.trim()) {
    lines.push(`💬 Комментарий проверяющего: ${reviewerComment.trim()}`);
  }

  return lines.join("\n").trim();
}