// src/keyboardUserRegistration.ts

import { InlineKeyboard } from "grammy";

/**
 * Клавиатура пользователя после выбора предметов.
 * @returns {InlineKeyboard}
 */
export function userKeyboard_Registration() {
  return new InlineKeyboard()
    .text("✏️ Изменить выбранные предметы", "change_subjects");
}

/**
 * Динамическая клавиатура выбора предметов.
 * @param {string[]} selected - уже выбранные предметы
 * @param {string[]} allSubjects - полный список доступных предметов
 * @returns {InlineKeyboard}
 */
export function keyboardSubjectSelection(selected: string[], allSubjects: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const selectedSet = new Set(selected);

  for (const subject of allSubjects) {
    keyboard.text(
      (selectedSet.has(subject) ? "✅ " : "⬜ ") + subject,
      `toggle_${subject}`
    ).row();
  }

  keyboard
    .row()
    .text("✅ Готово", "subjects_done")
    .row()
    .text("❌ Позже", "subjects_cancel");

  return keyboard;
}