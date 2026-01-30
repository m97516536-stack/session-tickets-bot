// src/commands/commandStart.ts

import { MyContext, UserRecord } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { readJson } from "../storage/jsonStorage.js";
import { USERS_FILE } from "../config.js";
import { fastCheckPhase } from "../utils/updatePhase.js";
import { userKeyboard_Registration } from "../keyboards/keyboardUserRegistration.js";
import { userKeyboard_Ticketing, getUserTicketsText } from "../keyboards/keyboardUserTicketing.js";

/**
 * Обрабатывает команду /start: управляет регистрацией пользователя или показывает меню билетов.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function commandStart(ctx: MyContext) {
  if (ctx.chat?.type !== "private") return;

  const currentPhase = await fastCheckPhase();

  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const userId = String(ctx.from?.id);

  if (users[userId]) {
    let text = "Выберите действие:";
    let keyboard;

    if (currentPhase == "registration") {
      text = "📋 Меню регистрации";
      keyboard = userKeyboard_Registration();
    } else if (currentPhase == "editing") {
      text = "✏️ Сейчас идёт этап редактирования. Пожалуйста, дождитесь его окончания.";
      keyboard = undefined;
    } else if (currentPhase == "ticketing") {
      try {
        const user = users[userId];
        text = await getUserTicketsText(user);
        keyboard = userKeyboard_Ticketing();
      } catch (err) {
        console.error("Ошибка при генерации текста билетов в /start:", err);
        text = "⚠️ Не удалось загрузить список билетов.";
        keyboard = undefined;
      }
    } else if (currentPhase == "finished") {
      text = "✅ Всё завершено";
      keyboard = undefined;
    } else return;

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "user",
      true
    );
    return;
  }

  if (currentPhase !== "registration") return;

  ctx.session.user.state = "awaiting_fio";

  await manageKeyboard(
    ctx,
    "Введите вашу фамилию и имя:",
    undefined,
    "user",
    true
  );
}