// src/commands/commandAdmin.ts

import { MyContext } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { adminKeyboard_Preparation } from "../keyboards/keyboardAdminPreparation.js";
import { adminKeyboard_Registration } from "../keyboards/keyboardAdminRegistration.js";
import { adminKeyboard_Editing } from "../keyboards/keyboardAdminEditing.js";
import { fastCheckPhase } from "../utils/updatePhase.js";
import { ADMIN_ID } from "../config.js";

export async function commandAdmin(ctx: MyContext) {
  if (ctx.chat?.type !== "private") return;
  if (ctx.from?.id !== ADMIN_ID) return;

  const currentPhase = await fastCheckPhase();

  let text = "Выберите действие:";
  let keyboard;

  if (currentPhase === "preparation") {
    text = "🔧 Админ-панель (подготовительный этап)";
    keyboard = adminKeyboard_Preparation();
  } else if (currentPhase === "registration") {
    text = "📋 Админ-панель (этап регистрации)";
    keyboard = adminKeyboard_Registration();
  } else if (currentPhase === "editing") {
    text = "✏️ Админ-панель (этап редактирования)";
    keyboard = adminKeyboard_Editing();
  } else if (currentPhase === "ticketing") {
    text = "📝 Админ-панель (этап подготовки билетов)";
    // keyboard = adminKeyboard_Ticketing();
  } else if (currentPhase === "finished") {
    text = "✅ Админ-панель (всё завершено)";
    // keyboard = adminKeyboard_Finished();
  } else return;

  await manageKeyboard(
    ctx,
    text,
    keyboard,
    "admin",
    true
  );
}