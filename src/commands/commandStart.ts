// src/commands/commandStart.ts

import { MyContext, UserRecord } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { readJson } from "../storage/jsonStorage.js";
import { USERS_FILE } from "../config.js";
import { fastCheckPhase } from "../utils/updatePhase.js";
import { userKeyboard_Registration } from "../keyboards/keyboardUserRegistration.js";

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
    } else if (currentPhase == "preparation") {
      text = "📝 Меню подготовки";
      // keyboard = userKeyboard_Preparation();
    } else if (currentPhase == "finished") {
      text = "✅ Всё завершено";
      // keyboard = userKeyboard_Finished();
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