import { MyContext } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { adminKeyboard_SetDeadlines, adminKeyboard_AwaitingDate } from "../keyboards/adminKeyboard.js";
import { ADMIN_ID } from "../config.js";
import { getDeadlinesText } from "../utils/adminTexts.js";
import { updateCurrentPhase } from "../utils/updatePhase.js";

export async function handleDateInput(ctx: MyContext) {
  if (ctx.from?.id !== ADMIN_ID) return;

  updateCurrentPhase(ctx.session.admin);

  if (ctx.session.admin.currentPhase !== undefined && ctx.session.admin.currentPhase !== "registration") {
    await manageKeyboard(
      ctx,
      "❌ Этап изменился. Ввод дат больше недоступен.",
      undefined,
      "admin",
      true
    );
    delete ctx.session.admin.state;
    return;
  }

  const text = ctx.message?.text?.trim();

  const state = ctx.session.admin.state;
  if (!state || !state.startsWith("awaiting_")) return;

  const stage = state.replace("awaiting_", "").replace("_end_date", "") as "registration" | "editing" | "preparation";

  if (!text) {
    await manageKeyboard(
      ctx,
      `❌ Введите корректную дату в формате YYYY-MM-DD.\n\nВведите дату окончания ${stage} (формат: YYYY-MM-DD):`,
      adminKeyboard_AwaitingDate(stage),
      "admin",
      true
    );
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    await manageKeyboard(
      ctx,
      `❌ Неверный формат даты. Используйте YYYY-MM-DD.\n\nВведите дату окончания ${stage} (формат: YYYY-MM-DD):`,
      adminKeyboard_AwaitingDate(stage),
      "admin",
      true
    );
    return;
  }

  let date = new Date(text);
  if (isNaN(date.getTime())) {
    await manageKeyboard(
      ctx,
      `❌ Неверная дата. Проверьте формат и значение.\n\nВведите дату окончания ${stage} (формат: YYYY-MM-DD):`,
      adminKeyboard_AwaitingDate(stage),
      "admin",
      true
    );
    return;
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  date = new Date(Date.UTC(year, month, day, 23, 0, 0, 0));

  if (ctx.session.admin.state === "awaiting_registration_end_date") {
    if (!ctx.session.admin.deadlines) {
      ctx.session.admin.deadlines = {
        registrationEnd: "",
        editingEnd: "",
        preparationEnd: "",
      };
    }
    ctx.session.admin.deadlines.registrationEnd = date.toISOString();
    delete ctx.session.admin.state;
  } else if (ctx.session.admin.state === "awaiting_editing_end_date") {
    if (!ctx.session.admin.deadlines) {
      ctx.session.admin.deadlines = {
        registrationEnd: "",
        editingEnd: "",
        preparationEnd: "",
      };
    }
    ctx.session.admin.deadlines.editingEnd = date.toISOString();
    delete ctx.session.admin.state;
  } else if (ctx.session.admin.state === "awaiting_preparation_end_date") {
    if (!ctx.session.admin.deadlines) {
      ctx.session.admin.deadlines = {
        registrationEnd: "",
        editingEnd: "",
        preparationEnd: "",
      };
    }
    ctx.session.admin.deadlines.preparationEnd = date.toISOString();
    delete ctx.session.admin.state;
  } else {
    return;
  }

  await manageKeyboard(
    ctx,
    getDeadlinesText(ctx.session.admin),
    adminKeyboard_SetDeadlines(),
    "admin",
    false
  );
}