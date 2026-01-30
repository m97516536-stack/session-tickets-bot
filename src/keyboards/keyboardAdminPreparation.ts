// src/keyboards/keyboardAdminPreRegistration.ts

import { InlineKeyboard } from "grammy";
import { AdminSession } from "../types.js";

/**
 * Форматирует дату в формат DD.MM.YYYY (UTC).
 * @param {string} dateString - ISO-строка даты
 * @returns {string} отформатированная дата
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Генерирует текстовое сообщение с текущими дедлайнами.
 * @param {AdminSession} adminSession - сессия админа с полями deadlines
 * @returns {string} готовое сообщение для отправки пользователю
 */
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

/**
 * Клавиатура для запуска этапа регистрации.
 * @returns {InlineKeyboard}
 */
export function adminKeyboard_Preparation() {
  return new InlineKeyboard()
    .text("📝 Начать этап регистрации", "start_registration");
}

/**
 * Клавиатура для установки дедлайнов по этапам.
 * @returns {InlineKeyboard}
 */
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

/**
 * Клавиатура-заглушка при ожидании ввода даты.
 * @param {"registration" | "editing" | "ticketing"} forStage - этап, для которого ждём дату
 * @returns {InlineKeyboard}
 */
export function adminKeyboard_AwaitingDate(forStage: "registration" | "editing" | "ticketing") {
  return new InlineKeyboard()
    .text(`⏳ Введите дату (${forStage})...`, `awaiting_input_${forStage}`)
    .row()
    .text("❌ Отмена", "cancel_set_date");
}