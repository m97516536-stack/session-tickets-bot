// src/keyboards/keyboardAdminRegistration.ts

import { InlineKeyboard } from "grammy";

/**
 * Клавиатура администратора на этапе регистрации.
 * @returns {InlineKeyboard}
 */
export function adminKeyboard_Registration() {
  return new InlineKeyboard()
    .text("📋 Все пользователи", "view_all_users")
    .row()
    .text("📚 Пользователи по предметам", "view_users_by_subject")
    .row()
    .text("📊 Статистика", "view_stats");
}