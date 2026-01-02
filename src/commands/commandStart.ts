// src/commands/commandStart.ts

import { MyContext, UserRecord } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { readJson } from "../storage/jsonStorage.js";
import { USERS_FILE } from "../config.js";
import { updateCurrentPhase } from "../utils/updatePhase.js";
import { userKeyboard_Registration } from "../keyboards/keyboardUserRegistration.js";

export async function commandStart(ctx: MyContext) {
  if (ctx.chat?.type !== "private") return;

  updateCurrentPhase(ctx.session.admin);

  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const userId = String(ctx.from?.id);

  if (users[userId]) {
    let text = "Выберите действие:";
    let keyboard;

    if (ctx.session.admin.currentPhase === "registration") {
      text = "📋 Меню регистрации";
      keyboard = userKeyboard_Registration();
    } else if (ctx.session.admin.currentPhase === "editing") {
      text = "✏️ Меню редактирования";
      // keyboard = userKeyboard_Editing();
    } else if (ctx.session.admin.currentPhase === "preparation") {
      text = "📝 Меню подготовки";
      // keyboard = userKeyboard_Preparation();
    } else if (ctx.session.admin.currentPhase === "finished") {
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

  if (ctx.session.admin.currentPhase !== "registration") return;

  ctx.session.user.state = "awaiting_fio";

  await manageKeyboard(
    ctx,
    "Введите вашу фамилию и имя:",
    undefined,
    "user",
    true
  );
}