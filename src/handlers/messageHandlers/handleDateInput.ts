// src/handlers/messageHandlers/handleDateInput.ts
// Preparation

import { MyContext } from "../../types.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { adminKeyboard_SetDeadlines, adminKeyboard_AwaitingDate } from "../../keyboards/keyboardAdminPreparation.js";
import { getDeadlinesText } from "../../keyboards/keyboardAdminPreparation.js";
import { deleteMessages } from "../../utils/deleteMessages.js";

/**
 * Обрабатывает ввод даты администратором при установке дедлайнов.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleDateInput(ctx: MyContext) {
  const text = ctx.message?.text?.trim();
  const chatId = ctx.chat?.id;

  const state = ctx.session.admin.state;
  if (!state || !state.startsWith("awaiting_")) return;

  const stage = state.replace("awaiting_", "").replace("_end_date", "") as "registration" | "editing" | "ticketing";

  await deleteMessages(ctx.api, chatId, ctx.message?.message_id);

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
        ticketingEnd: "",
      };
    }
    ctx.session.admin.deadlines.registrationEnd = date.toISOString();
    delete ctx.session.admin.state;
  } else if (ctx.session.admin.state === "awaiting_editing_end_date") {
    if (!ctx.session.admin.deadlines) {
      ctx.session.admin.deadlines = {
        registrationEnd: "",
        editingEnd: "",
        ticketingEnd: "",
      };
    }
    ctx.session.admin.deadlines.editingEnd = date.toISOString();
    delete ctx.session.admin.state;
  } else if (ctx.session.admin.state === "awaiting_ticketing_end_date") {
    if (!ctx.session.admin.deadlines) {
      ctx.session.admin.deadlines = {
        registrationEnd: "",
        editingEnd: "",
        ticketingEnd: "",
      };
    }
    ctx.session.admin.deadlines.ticketingEnd = date.toISOString();
    delete ctx.session.admin.state;
  } else {
    return;
  }

  await manageKeyboard(
    ctx,
    await getDeadlinesText(ctx.session.admin),
    adminKeyboard_SetDeadlines(),
    "admin",
    true
  );
}