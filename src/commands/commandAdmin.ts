// src/commands/commandAdmin.ts

import { MyContext } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { adminKeyboard_SetDeadlines, getDeadlinesText } from "../keyboards/keyboardAdminPreparation.js";
import { adminKeyboard_Registration } from "../keyboards/keyboardAdminRegistration.js";
import { adminKeyboard_Editing } from "../keyboards/keyboardAdminEditing.js";
import { adminKeyboard_Ticketing } from "../keyboards/keyboardAdminTicketing.js";
import { fastCheckPhase } from "../utils/updatePhase.js";
import { ADMIN_IDS } from "../config.js";

/**
 * Обрабатывает команду /admin: открывает админ-панель в зависимости от текущей фазы.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function commandAdmin(ctx: MyContext) {
  if (ctx.chat?.type !== "private") return;
  if (ctx.from?.id === undefined || !ADMIN_IDS.includes(ctx.from.id)) return;

  const currentPhase = await fastCheckPhase();

  let text = "Выберите действие:";
  let keyboard;

  if (currentPhase === "preparation") {
    text = await getDeadlinesText(ctx.session.admin);
    keyboard = adminKeyboard_SetDeadlines();
  } else if (currentPhase === "registration") {
    text = "📋 Админ-панель (этап регистрации)";
    keyboard = adminKeyboard_Registration();
  } else if (currentPhase === "editing") {
    text = "✏️ Админ-панель (этап редактирования)";
    keyboard = adminKeyboard_Editing();
  } else if (currentPhase === "ticketing" || currentPhase === "finished") {
    text = "📝 Админ-панель (этап подготовки билетов)";
    keyboard = adminKeyboard_Ticketing(currentPhase === "finished");
  } else return;

  await manageKeyboard(
    ctx,
    text,
    keyboard,
    "admin",
    true
  );
}