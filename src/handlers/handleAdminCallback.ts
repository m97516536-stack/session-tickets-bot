// src/handlers/handleAdminCallback.ts

import { MyContext } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { adminKeyboard_SetDeadlines, adminKeyboard_AwaitingDate } from "../keyboards/adminKeyboard.js";
import { ADMIN_ID } from "../config.js";
import { updateCurrentPhase } from "../utils/updatePhase.js";
import { getDeadlinesText } from "../utils/adminTexts.js";

export async function handleAdminCallback(ctx: MyContext) {
  if (ctx.from?.id !== ADMIN_ID) return;

  const data = ctx.callbackQuery?.data;

  if (data === "start_registration") {
    if (ctx.session.admin.currentPhase !== undefined) {
      await ctx.answerCallbackQuery("❌ Этап уже начался.");
      return;
    }
    
    await ctx.answerCallbackQuery();
    ctx.session.admin.state = "setting_deadlines";

    await manageKeyboard(
      ctx,
      getDeadlinesText(ctx.session.admin),
      adminKeyboard_SetDeadlines(),
      "admin",
      false
    );
    return;
  }

  if (data === "awaiting_input_registration") {
    await ctx.answerCallbackQuery({
      text: "Введите дату окончания регистрации (формат: YYYY-MM-DD)",
      show_alert: true,
    });
    return;
  }

  if (data === "awaiting_input_editing") {
    await ctx.answerCallbackQuery({
      text: "Введите дату окончания редактирования (формат: YYYY-MM-DD)",
      show_alert: true,
    });
    return;
  }

  if (data === "awaiting_input_preparation") {
    await ctx.answerCallbackQuery({
      text: "Введите дату окончания подготовки (формат: YYYY-MM-DD)",
      show_alert: true,
    });
    return;
  }

  if (data === "set_reg_end") {
    await ctx.answerCallbackQuery();
    ctx.session.admin.state = "awaiting_registration_end_date";

    await manageKeyboard(
      ctx,
      getDeadlinesText(ctx.session.admin) + "\n\nВведите дату окончания регистрации (формат: YYYY-MM-DD):",
      adminKeyboard_AwaitingDate("registration"),
      "admin",
      true
    );
    return;
  }

  if (data === "set_edit_end") {
    await ctx.answerCallbackQuery();
    ctx.session.admin.state = "awaiting_editing_end_date";

    await manageKeyboard(
      ctx,
      getDeadlinesText(ctx.session.admin) + "\n\nВведите дату окончания редактирования (формат: YYYY-MM-DD):",
      adminKeyboard_AwaitingDate("editing"),
      "admin",
      true
    );
    return;
  }

  if (data === "set_prep_end") {
    await ctx.answerCallbackQuery();
    ctx.session.admin.state = "awaiting_preparation_end_date";

    await manageKeyboard(
      ctx,
      getDeadlinesText(ctx.session.admin) + "\n\nВведите дату окончания подготовки (формат: YYYY-MM-DD):",
      adminKeyboard_AwaitingDate("preparation"),
      "admin",
      true
    );
    return;
  }

  if (data === "cancel_set_date") {
    await ctx.answerCallbackQuery();
    ctx.session.admin.state = "setting_deadlines";

    await manageKeyboard(
      ctx,
      getDeadlinesText(ctx.session.admin),
      adminKeyboard_SetDeadlines(),
      "admin",
      false
    );
    return;
  }

  if (data === "confirm_deadlines") {
    await ctx.answerCallbackQuery();

    if (!ctx.session.admin.deadlines) {
      await manageKeyboard(
        ctx,
        "❌ Не все даты установлены. Установите все даты перед подтверждением.",
        adminKeyboard_SetDeadlines(),
        "admin",
        false
      );
      return;
    }

    if (!ctx.session.admin.deadlines.registrationEnd || !ctx.session.admin.deadlines.editingEnd || !ctx.session.admin.deadlines.preparationEnd) {
      await manageKeyboard(
        ctx,
        "❌ Не все даты установлены. Установите все даты перед подтверждением.",
        adminKeyboard_SetDeadlines(),
        "admin",
        false
      );
      return;
    }

    updateCurrentPhase(ctx.session.admin);

    delete ctx.session.admin.state;

    await manageKeyboard(
      ctx,
      "✅ Этап регистрации начался!\nТеперь участники могут регистрироваться.",
      undefined,
      "admin",
      false
    );
    return;
  }
}