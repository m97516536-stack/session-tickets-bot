// src/keyboardUserRegistration.ts

import { InlineKeyboard } from "grammy";

export function userKeyboard_Registration() {
  return new InlineKeyboard()
    .text("✏️ Изменить выбранные предметы", "change_subjects");
}

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