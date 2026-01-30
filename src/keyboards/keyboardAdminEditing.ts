// src/keyboards/keyboardAdminEditing.ts

import { InlineKeyboard } from "grammy";

/**
 * Клавиатура администратора на этапе редактирования.
 * @returns {InlineKeyboard}
 */
export function adminKeyboard_Editing() {
  return new InlineKeyboard()
    .text("📋 Все пользователи", "view_all_users")
    .row()
    .text("📚 Пользователи по предметам", "view_users_by_subject")
    .row()
    .text("📊 Статистика", "view_stats")
    .row()
    .text("📥 Загрузить данные из таблицы", "download_from_sheet")
}
