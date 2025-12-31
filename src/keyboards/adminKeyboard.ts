// src/keyboards/adminKeyboard.ts

import { InlineKeyboard } from "grammy";

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
    .text(`📅 3. Подготовка`, "set_prep_end")
    .row()
    .text("✅ Подтвердить", "confirm_deadlines");
}

export function adminKeyboard_AwaitingDate(forStage: "registration" | "editing" | "preparation") {
  return new InlineKeyboard()
    .text(`⏳ Введите дату (${forStage})...`, `awaiting_input_${forStage}`)
    .row()
    .text("❌ Отмена", "cancel_set_date");
}