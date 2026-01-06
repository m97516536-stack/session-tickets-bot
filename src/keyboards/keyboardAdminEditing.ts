// src/keyboards/keyboardAdminEditing.ts

import { InlineKeyboard } from "grammy";

export function adminKeyboard_Editing() {
  return new InlineKeyboard()
    .text("📋 Все пользователи", "view_all_users")
    .row()
    .text("📚 Пользователи по предметам", "view_users_by_subject")
    .row()
    .text("📊 Статистика", "view_stats")
    .row()
    .text("📥 Загрузить из таблицы", "download_from_sheet")
    .row()
    .text("🗑 Удалить участника", "remove_user")
    .row()
    .text("✏️ Редактировать участника", "edit_user");
}