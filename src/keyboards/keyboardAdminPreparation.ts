// src/keyboards/keyboardAdminPreRegistration.ts

import { InlineKeyboard } from "grammy";
import { AdminSession } from "../types.js";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

export function getDeadlinesText(adminSession: AdminSession): string {
  const deadlines = adminSession.deadlines;
  return (
    "📅 Установите даты окончания этапов:\n\n" +
    `1. Регистрация: ${deadlines?.registrationEnd ? formatDate(deadlines.registrationEnd) : "не установлена"}\n` +
    `2. Редактирование: ${deadlines?.editingEnd ? formatDate(deadlines.editingEnd) : "не установлена"}\n` +
    `3. Подготовка: ${deadlines?.ticketingEnd ? formatDate(deadlines.ticketingEnd) : "не установлена"}\n\n` +
    "Нажмите на кнопку, чтобы установить дату."
  );
}

export function adminKeyboard_Preparation() {
  return new InlineKeyboard()
    .text("📝 Начать этап регистрации", "start_registration");
}

export function adminKeyboard_SetDeadlines() {
  return new InlineKeyboard()
    .text(`📅 1. Регистрация`, "set_reg_end")
    .row()
    .text(`📅 2. Редактирование`, "set_edit_end")
    .row()
    .text(`📅 3. Подготовка`, "set_tick_end")
    .row()
    .text("✅ Подтвердить", "confirm_deadlines");
}

export function adminKeyboard_AwaitingDate(forStage: "registration" | "editing" | "ticketing") {
  return new InlineKeyboard()
    .text(`⏳ Введите дату (${forStage})...`, `awaiting_input_${forStage}`)
    .row()
    .text("❌ Отмена", "cancel_set_date");
}