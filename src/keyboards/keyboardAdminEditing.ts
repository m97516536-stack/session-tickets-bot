// src/keyboards/keyboardAdminEditing.ts

import { InlineKeyboard } from "grammy";

/**
 * Клавиатура администратора на этапе редактирования.
 * @returns {InlineKeyboard} Инлайн-клавиатура с основными действиями админа.
 */
export function adminKeyboard_Editing() {
  return new InlineKeyboard()
    .text("📋 Все пользователи", "view_all_users")
    .row()
    .text("📚 Пользователи по предмету", "view_users_by_subject")
    .row()
    .text("👑 Список редакторов", "view_editors")
    .row()
    .text("📊 Статистика регистрации", "view_stats")
    .row()
    .text("📢 Спам сообщение", "admin_spam")
    .row()
    .text("📥 Загрузить данные из таблицы", "download_from_sheet");
}

/**
 * Клавиатура выбора режима загрузки данных из таблицы.
 * @returns {InlineKeyboard} Клавиатура с опциями перераспределения.
 */
export function adminKeyboard_DownloadModeSelection() {
  return new InlineKeyboard()
    .text("🔄 С перераспределением", "mode_with_redistribution")
    .row()
    .text("✏️ Без распределения", "mode_without_redistribution")
    .row()
    .text("📤 Записать в таблицу", "upload_to_sheet")
    .row()
    .text("🔄 Добавить новый предмет", "load_new_subject")
    .row()
    .text("🗑️ Удалить предмет", "delete_subject")
    .row()
    .text("🔙 Назад", "admin_cancel");
}

/**
 * Клавиатура выбора предмета для загрузки из таблицы.
 * @param {string[]} subjects - список доступных предметов
 * @returns {InlineKeyboard} Клавиатура с кнопками предметов и кнопкой назад.
 */
export function adminKeyboard_SubjectSelectionForDownload(subjects: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  for (const subject of subjects) {
    keyboard.text(subject, `download_subject_${subject}`).row();
  }
  
  keyboard.row().text("🔙 Назад", "admin_cancel");
  
  return keyboard;
}

/**
 * Клавиатура выбора предмета для записи в таблицу.
 * @param {string[]} subjects - список доступных предметов
 * @returns {InlineKeyboard} Клавиатура с кнопками предметов и кнопкой назад.
 */
export function adminKeyboard_SubjectSelectionForUpload(subjects: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  for (const subject of subjects) {
    keyboard.text(subject, `upload_subject_${subject}`).row();
  }
  
  keyboard.row().text("🔙 Назад", "admin_cancel");
  
  return keyboard;
}

/**
 * Клавиатура выбора предмета для просмотра пользователй.
 * @param {string[]} subjects - список доступных предметов
 * @returns {InlineKeyboard} Клавиатура с кнопками предметов и кнопкой назад.
 */
export function adminKeyboard_SubjectSelectionForUsers(subjects: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  for (const subject of subjects) {
    keyboard.text(subject, `view_users_for_${subject}`).row();
  }
  
  keyboard.row().text("🔙 Назад", "admin_cancel");
  
  return keyboard;
}