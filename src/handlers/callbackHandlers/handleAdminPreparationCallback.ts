// src/handlers/callbackHandlers/handleAdminPreregistrationCallback.ts

import { MyContext } from "../../types.js";
import { PHASE_CONFIG_FILE } from "../../config.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { PhaseConfig } from "../../types.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { adminKeyboard_SetDeadlines, adminKeyboard_AwaitingDate, getDeadlinesText } from "../../keyboards/keyboardAdminPreparation.js";
import { adminKeyboard_Registration } from "../../keyboards/keyboardAdminRegistration.js";

/**
 * Обрабатывает действия администратора на подготовительном этапе (установка дедлайнов).
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleAdminPreparationCallback(ctx: MyContext) {
  const data = ctx.callbackQuery?.data;

  if (data === "start_registration") {
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

  if (data === "awaiting_input_ticketing") {
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

  if (data === "set_tick_end") {
    await ctx.answerCallbackQuery();

    ctx.session.admin.state = "awaiting_ticketing_end_date";

    await manageKeyboard(
      ctx,
      getDeadlinesText(ctx.session.admin) + "\n\nВведите дату окончания подготовки (формат: YYYY-MM-DD):",
      adminKeyboard_AwaitingDate("ticketing"),
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

    if (!ctx.session.admin.deadlines.registrationEnd || !ctx.session.admin.deadlines.editingEnd || !ctx.session.admin.deadlines.ticketingEnd) {
      await manageKeyboard(
        ctx,
        "❌ Не все даты установлены. Установите все даты перед подтверждением.",
        adminKeyboard_SetDeadlines(),
        "admin",
        false
      );
      return;
    }

    try {
      let phaseConfig: PhaseConfig = await readJson<PhaseConfig>(PHASE_CONFIG_FILE);

      phaseConfig.deadlines = {
        registrationEnd: ctx.session.admin.deadlines.registrationEnd,
        editingEnd: ctx.session.admin.deadlines.editingEnd,
        ticketingEnd: ctx.session.admin.deadlines.ticketingEnd,
      };
      phaseConfig.currentPhase = "registration";

      await writeJson(PHASE_CONFIG_FILE, phaseConfig);
    } catch (error) {
      console.error("❌ Ошибка при сохранении дедлайнов в файл:", error);
      await manageKeyboard(
        ctx,
        "❌ Ошибка при сохранении дедлайнов.",
        adminKeyboard_SetDeadlines(),
        "admin",
        false
      );
      return;
    }

    delete ctx.session.admin.state;
    delete ctx.session.admin.deadlines;

    await manageKeyboard(
      ctx,
      "✅ Этап регистрации начался!\nТеперь участники могут регистрироваться.",
      adminKeyboard_Registration(),
      "admin",
      false
    );
    return;
  }

  await ctx.answerCallbackQuery({
    text: "❌ Неизвестная команда.",
    show_alert: true
  });
}