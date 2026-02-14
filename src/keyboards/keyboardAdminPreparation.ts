// src/keyboards/keyboardAdminPreparation.ts

import { InlineKeyboard } from "grammy";
import { AdminSession } from "../types.js";
import { readJson } from "../storage/jsonStorage.js";
import { AllSubjectsData } from "../types.js";
import { SUBJECTS_DATA_FILE } from "../config.js";

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
 * Генерирует текстовое сообщение с текущими дедлайнами и списком загруженных предметов.
 * @param {AdminSession} adminSession - сессия админа с полями deadlines
 * @returns {string} готовое сообщение для отправки пользователю
 */
export async function getDeadlinesText(adminSession: AdminSession): Promise<string> {
  const deadlines = adminSession.deadlines;

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const loadedSubjects = Object.keys(subjectsData).filter(subject => 
    Array.isArray(subjectsData[subject]) && subjectsData[subject].length > 0
  );

  let text = "📅 Установите даты окончания этапов:\n\n";
  
  text += `1. Регистрация: ${deadlines?.registrationEnd ? formatDate(deadlines.registrationEnd) : "не установлена"}\n`;
  text += `2. Редактирование: ${deadlines?.editingEnd ? formatDate(deadlines.editingEnd) : "не установлена"}\n`;
  text += `3. Подготовка: ${deadlines?.ticketingEnd ? formatDate(deadlines.ticketingEnd) : "не установлена"}\n\n`;
  
  if (loadedSubjects.length > 0) {
    text += `📚 Загружено предметов (${loadedSubjects.length}):\n`;
    text += loadedSubjects.map((subject, index) => `   ${index + 1}. ${subject}`).join('\n');
    text += '\n\n';
  } else {
    text += "📚 Предметы не загружены.\n\n";
  }
  
  text += "Нажмите на кнопку, чтобы установить дату или загрузить предметы.";
  
  return text;
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
 * Клавиатура для установки дедлайнов по этапам или загрузки предметов.
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
    .text("📥 Загрузить предметы", "load_subjects_from_sheet")
    .row()
    .text("✅ Подтвердить и начать этап регистрации", "confirm_deadlines");
}

/**
 * Клавиатура-заглушка при ожидании ввода даты.
 * @param {"registration" | "editing" | "ticketing"} forStage - этап, для которого ждём дату
 * @returns {InlineKeyboard}
 */
export function adminKeyboard_AwaitingDate(forStage: "registration" | "editing" | "ticketing") {
  return new InlineKeyboard()
    .text(`⏳ Введите дату (${forStage})...`, "awaiting")
    .row()
    .text("❌ Отмена", "cancel");
}

/**
 * Клавиатура-заглушка при ожидании ввода пердметов.
 * @returns {InlineKeyboard}
 */
export function adminKeyboard_AwaitingSubjectName() {
  return new InlineKeyboard()
    .text("⏳ Введите названия предметов...", "awaiting")
    .row()
    .text("❌ Отмена", "cancel");
}