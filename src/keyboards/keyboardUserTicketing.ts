// src/keyboards/keyboardUserTicketing.ts

import { InlineKeyboard } from "grammy";
import { UserRecord, AllSubjectsData } from "../types.js";
import { readJson } from "../storage/jsonStorage.js";
import { SUBJECTS_DATA_FILE } from "../config.js";

/**
 * Формирует текстовое сообщение со списком билетов пользователя.
 * @param {UserRecord} user - запись пользователя с assignedTickets
 * @returns {Promise<string>}
 */
export async function getUserTicketsText(user: UserRecord): Promise<string> {
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const assigned = user.assignedTickets || {};
  const sections: string[] = [];

  for (const [subject, ticketNumbers] of Object.entries(assigned)) {
    if (!ticketNumbers?.length) continue;

    const subjectData = subjectsData[subject];
    if (!subjectData?.questions) {
      sections.push(`❌ ${subject}: данные недоступны`);
      continue;
    }

    const items: string[] = [];
    const sortedNumbers = [...ticketNumbers].sort((a, b) => a - b);

    for (const num of sortedNumbers) {
      const question = subjectData.questions.find(q => q.number === num);
      if (!question) {
        items.push(`  • ❓ ${num}. Вопрос не найден`);
        continue;
      }

      const emoji = 
        question.status === "approved" ? "🟢" :
        question.status === "revision" ? "🔴" :
        question.status === "pending"  ? "🟡" :
                                        "⚪";
      items.push(`  • ${emoji} ${num}. ${question.text}`);
    }

    if (items.length > 0) {
      sections.push(`📘 ${subject}\n${items.join('\n')}`);
    }
  }

  if (sections.length === 0) {
    return "У вас пока нет билетов.";
  }

  return "📋 Ваши билеты:\n\n" + sections.join("\n\n") + "\n\n" +
    "\n⚪ — не отправлен  🟡 — на проверке\n🔴 — на доработку  🟢 — принят";
}

/**
 * Основная клавиатура пользователя на этапе отправки решений.
 * @returns {InlineKeyboard}
 */
export function userKeyboard_Ticketing() {
  return new InlineKeyboard()
    .text("📚 Отправить билет", "submit_ticket");
}

/**
 * Клавиатура выбора билета для отправки решения.
 * @param {UserRecord} user - запись пользователя
 * @returns {Promise<InlineKeyboard>}
 */
export async function keyboardSubmitTicket(user: UserRecord): Promise<InlineKeyboard> {
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const keyboard = new InlineKeyboard();

  let hasAnyTickets = false;

  for (const [subject, ticketNumbers] of Object.entries(user.assignedTickets || {})) {
    const subjectData = subjectsData[subject];
    if (!subjectData || !Array.isArray(subjectData.questions)) continue;

    const sendableTickets = ticketNumbers.filter(num => {
      const q = subjectData.questions.find(q => q.number === num);
      return q && (q.status === "not_submitted" || q.status === "revision");
    });

    if (sendableTickets.length === 0) continue;

    hasAnyTickets = true;

    keyboard.text(`📘 ${subject}`, "noop").row();

    const sorted = [...sendableTickets].sort((a, b) => a - b);

    for (let i = 0; i < sorted.length; i += 5) {
      const row = sorted.slice(i, i + 5);
      for (const num of row) {
        keyboard.text(`№${num}`, `submit_ticket_${subject}_${num}`);
      }
      keyboard.row();
    }
  }

  if (!hasAnyTickets) {
    keyboard.text("❌ Нет билетов для отправки", "noop").row();
  }

  keyboard.text("🔙 Назад", "back_to_ticketing_menu");

  return keyboard;
}