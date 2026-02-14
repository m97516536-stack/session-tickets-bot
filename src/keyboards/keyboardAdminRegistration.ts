// src/keyboards/keyboardAdminRegistration.ts

import { InlineKeyboard } from "grammy";

/**
 * Клавиатура администратора на этапе регистрации.
 * Предоставляет доступ к управлению пользователями, статистике и редакторам.
 * @returns {InlineKeyboard} Инлайн-клавиатура с кнопками административных действий.
 */
export function adminKeyboard_Registration() {
  return new InlineKeyboard()
    .text("📊 Статистика регистрации", "view_stats")
    .row()
    .text("📋 Список пользователей", "view_all_users")
    .row()
    .text("📚 Пользователи по предмету", "view_users_by_subject")
    .row()
    .text("👑 Список редакторов", "view_editors")
    .row()
    .text("📢 Спам сообщение", "admin_spam")
    .row()
    .text("🔄 Добавить новый предмет", "load_new_subject")
    .row()
    .text("🗑️ Удалить предмет", "delete_subject")
    .row()
    .text("➕ Назначить редактора", "assign_editor")
    .row()
    .text("➖ Отстранить редактора", "remove_editor");
}

/**
 * Клавиатура для выбора предмета для просмотра пользователей
 * @param {string[]} allSubjects - список всех доступных предметов
 * @returns {InlineKeyboard} Клавиатура с предметами и кнопкой отмены.
 */
export function adminKeyboard_SelectSubjectForUsers(allSubjects: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const subject of allSubjects) {
    keyboard.text(`📚 ${subject}`, `view_users_for_${subject}`).row();
  }

  keyboard.row().text("❌ Отмена", "admin_cancel");

  return keyboard;
}

/**
 * Клавиатура для выбора предмета при назначении редактора.
 * @param {string[]} allSubjects - список всех доступных предметов
 * @returns {InlineKeyboard} Клавиатура с предметами и кнопкой отмены.
 */
export function adminKeyboard_SelectSubjectForEditor(allSubjects: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const subject of allSubjects) {
    keyboard.text(`📚 ${subject}`, `assign_editor_subject_${subject}`).row();
  }

  keyboard.row().text("❌ Отмена", "cancel_assign_editor");

  return keyboard;
}

/**
 * Клавиатура для выбора предмета при отстранении редактора.
 * @param {string[]} allSubjects - список всех доступных предметов
 * @returns {InlineKeyboard} Клавиатура с предметами и кнопкой отмены.
 */
export function adminKeyboard_SelectSubjectForRemoveEditor(allSubjects: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const subject of allSubjects) {
    keyboard.text(`📚 ${subject}`, `remove_editor_subject_${subject}`).row();
  }

  keyboard.row().text("❌ Отмена", "cancel_remove_editor");

  return keyboard;
}

/**
 * Клавиатура выбора источника пользователей для назначения редактора по конкретному предмету.
 * @param {string} subject - название выбранного предмета
 * @returns {InlineKeyboard} Клавиатура с опциями и отменой.
 */
export function adminKeyboard_SelectEditorSource(subject: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("📋 Список желающих", `editor_source_wishers_${subject}`)
    .row()
    .text("👥 Все пользователи", `editor_source_all_${subject}`)
    .row()
    .text("🔙 Назад", "cancel_assign_editor");
}

/**
 * Клавиатура выбора редакторов для отстранения по конкретному предмету.
 * @param {string} subject - название выбранного предмета
 * @returns {InlineKeyboard} Клавиатура с опциями и отменой.
 */
export function adminKeyboard_SelectRemoveEditorSource(subject: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔙 Назад", "cancel_remove_editor");
}