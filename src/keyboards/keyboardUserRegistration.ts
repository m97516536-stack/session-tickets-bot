// src/keyboardUserRegistration.ts

import { InlineKeyboard } from "grammy";

/**
 * Клавиатура пользователя после выбора предметов.
 * @returns {InlineKeyboard}
 */
export function userKeyboard_Registration() {
  return new InlineKeyboard()
    .text("✏️ Изменить выбранные предметы", "change_subjects")
    .row()
    .text("👑 Хочу быть редактором", "become_editor");
}

/**
 * Динамическая клавиатура выбора предметов.
 * @param {string[]} selected - уже выбранные предметы
 * @param {string[]} allSubjects - полный список доступных предметов
 * @returns {InlineKeyboard}
 */
export function keyboardSubjectSelection(
  selected: string[],
  allSubjects: string[]
): InlineKeyboard {
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

/**
 * Динамическая клавиатура выбора предметов, по которым пользователь хочет стать редактором.
 * @param {string[]} selected - уже выбранные пользователем предметы для редактирования
 * @param {string[]} allSubjects - полный список доступных предметов
 * @returns {InlineKeyboard} Инлайн-клавиатура с отметками о выборе и кнопками завершения или отмены.
 */
export function keyboardEditorSubjectSelection(
  selected: string[],
  allSubjects: string[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const selectedSet = new Set(selected);

  for (const subject of allSubjects) {
    keyboard
      .text(
        (selectedSet.has(subject) ? "👑✅ " : "👑⬜ ") + subject,
        `editor_toggle_${subject}`
      )
      .row();
  }

  keyboard
    .row()
    .text("✅ Готово", "editor_subjects_done")
    .row()
    .text("❌ Отмена", "editor_subjects_cancel");

  return keyboard;
}