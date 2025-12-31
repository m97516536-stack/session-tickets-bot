import { MyContext } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { adminKeyboard_Preparation, adminKeyboard_SetDeadlines } from "../keyboards/adminKeyboard.js";
import { updateCurrentPhase } from "../utils/updatePhase.js";
import { ADMIN_ID } from "../config.js";

export async function commandAdmin(ctx: MyContext) {
  if (ctx.chat?.type !== "private") return;
  if (ctx.from?.id !== ADMIN_ID) return;

  updateCurrentPhase(ctx.session.admin);

  let text = "Выберите действие:";
  let keyboard;

  if (ctx.session.admin.currentPhase === undefined) {
    text = "🔧 Админ-панель (подготовительный этап)";
    keyboard = adminKeyboard_Preparation();
  } else if (ctx.session.admin.currentPhase === "registration") {
    text = "📋 Админ-панель (этап регистрации)";
    // keyboard = adminKeyboard_Registration();
  } else if (ctx.session.admin.currentPhase === "editing") {
    text = "✏️ Админ-панель (этап редактирования)";
    // keyboard = adminKeyboard_Editing();
  } else if (ctx.session.admin.currentPhase === "preparation") {
    text = "📝 Админ-панель (этап подготовки)";
    // keyboard = adminKeyboard_Preparation();
  } else if (ctx.session.admin.currentPhase === "finished") {
    text = "✅ Админ-панель (всё завершено)";
    // keyboard = adminKeyboard_Finished();
  } else {
    text = "❌ Неизвестный этап.";
    keyboard = undefined;
  }

  await manageKeyboard(
    ctx,
    text,
    keyboard,
    "admin",
    true
  );
}