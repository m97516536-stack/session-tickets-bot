// src/keyboards/keyboardEditorTicketing.ts

import { InlineKeyboard } from "grammy";
import { readJson } from "../storage/jsonStorage.js";
import { SUBJECTS_DATA_FILE, USERS_FILE } from "../config.js";
import { AllSubjectsData, UserRecord } from "../types.js";

/**
 * Возвращает эмодзи для статуса билета.
 * @param status - статус билета
 * @returns эмодзи
 */
function getStatusEmoji(status?: string): string {
  return status === "approved" ? "🟢" :
         status === "revision" ? "🔴" :
         status === "pending"  ? "🟡" :
                                  "⚪";
}

/**
 * Формирует текст со списком билетов для редактора.
 * Показывает предметы, по которым пользователь является редактором,
 * с номерами билетов, ФИ исполнителя и статусами.
 * Включает ВСЕ билеты со всеми статусами.
 * @param user - запись редактора
 * @returns текстовое сообщение
 */
export async function getEditorTicketsText(user: UserRecord): Promise<string> {
  if (!user.editor || !user.editorSubjects?.length) {
    return "У вас нет прав редактора или не назначены предметы для проверки.";
  }

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  
  let text = "🛠️ Ваши билеты на проверку:\n\n";
  let hasAnyTickets = false;

  for (const subject of user.editorSubjects) {
    const subjectData = subjectsData[subject];
    if (!subjectData || !Array.isArray(subjectData)) continue;

    const editorTickets = user.assignedEditorTickets?.[subject] || [];
    if (editorTickets.length === 0) continue;

    const relevantTickets = subjectData.filter(q => 
      editorTickets.includes(q.number)
    );

    if (relevantTickets.length === 0) continue;

    hasAnyTickets = true;
    text += `📘 ${subject}:\n`;
    
    const sorted = [...relevantTickets].sort((a, b) => a.number - b.number);
    for (const question of sorted) {
      const student = users[String(question.assignedTo)]?.fio || "Неизвестно";
      const emoji = getStatusEmoji(question.status);
      text += `  ${emoji} №${question.number} — ${student}\n`;
    }
    text += "\n";
  }

  if (!hasAnyTickets) {
    text += "Нет билетов для проверки.";
  }

  return text;
}

/**
 * Клавиатура выбора билета для проверки редактором.
 * Показывает только билеты со статусами "pending" и "approved".
 * Билеты со статусом "approved" отображаются с 🟢, "pending" — с 🟡.
 * @param user - запись редактора
 * @returns клавиатура с билетами
 */
export async function keyboardEditorSelectTicket(user: UserRecord): Promise<InlineKeyboard> {
  if (!user.editor || !user.editorSubjects?.length) {
    const keyboard = new InlineKeyboard();
    keyboard.text("❌ Нет доступных предметов", "noop");
    return keyboard;
  }

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const keyboard = new InlineKeyboard();
  let hasAnyTickets = false;

  for (const subject of user.editorSubjects) {
    const subjectData = subjectsData[subject];
    if (!subjectData || !Array.isArray(subjectData)) continue;

    const editorTickets = user.assignedEditorTickets?.[subject] || [];
    const reviewableTickets = subjectData.filter(q => 
      editorTickets.includes(q.number) && 
      (q.status === "pending" || q.status === "approved")
    );

    if (reviewableTickets.length === 0) continue;

    hasAnyTickets = true;
    keyboard.text(`📘 ${subject}`, "noop").row();

    const sorted = [...reviewableTickets].sort((a, b) => a.number - b.number);

    for (let i = 0; i < sorted.length; i += 5) {
      const row = sorted.slice(i, i + 5);
      for (const question of row) {
        const emoji = getStatusEmoji(question.status);
        keyboard.text(`${emoji} №${question.number}`, `edit_ticket_${subject}_${question.number}`);
      }
      keyboard.row();
    }
  }

  if (!hasAnyTickets) {
    keyboard.text("❌ Нет билетов для проверки", "noop").row();
  }

  keyboard.text("🔄 Обновить", "reboot_editor_menu");

  return keyboard;
}

/**
 * Клавиатура действий над билетом (полная версия).
 * Используется для билетов со статусом "pending".
 * @param subject - название предмета
 * @param ticketNumber - номер билета
 * @returns клавиатура с действиями
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
 * Клавиатура действий над билетом (только замена файла).
 * Используется для билетов со статусом "approved" (только замена при необходимости).
 * @param subject - название предмета
 * @param ticketNumber - номер билета
 * @returns клавиатура с одной кнопкой
 */
export function keyboardEditorTicketReplaceOnly(subject: string, ticketNumber: number): InlineKeyboard {
  const base = `review_${subject}_${ticketNumber}`;
  return new InlineKeyboard()
    .text("📤 Заменить файл", `${base}_replace`);
}

/**
 * Формирует подробный текст для конкретного билета.
 * Содержит: вопрос, ФИ студента, комментарии, статус.
 * @param subject - название предмета
 * @param ticketNumber - номер билета
 * @returns текстовое сообщение с деталями билета
 */
export async function buildEditorTicketCaption(
  subject: string,
  ticketNumber: number
): Promise<string> {
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  
  const subjectData = subjectsData[subject];
  if (!subjectData || !Array.isArray(subjectData)) {
    return `❌ Предмет "${subject}" не найден.`;
  }

  const question = subjectData.find(q => q.number === ticketNumber);
  if (!question) {
    return `❌ Билет №${ticketNumber} не найден в предмете "${subject}".`;
  }

  const student = users[String(question.assignedTo)]?.fio || "Неизвестно";
  const statusMap: Record<string, string> = {
    "not_submitted": "Не отправлен",
    "pending": "На проверке",
    "approved": "Принят",
    "revision": "На доработке"
  };
  const statusText = statusMap[question.status || "not_submitted"] || question.status;
  const statusEmoji = getStatusEmoji(question.status);

  let caption = `#билет #${subject.replace(/\s+/g, '')} #Вопрос${ticketNumber}\n\n`;
  caption += `❓ Вопрос:\n${question.text}\n\n`;
  caption += `👤 Студент: ${student}\n`;
  caption += `📊 Статус: ${statusEmoji} ${statusText}\n`;

  if (question.comment) {
    caption += `\n💬 Комментарий студента:\n${question.comment}\n`;
  }

  if (question.editorComment) {
    caption += `\n✏️ Комментарий редактора:\n${question.editorComment}\n`;
  }

  return caption;
}