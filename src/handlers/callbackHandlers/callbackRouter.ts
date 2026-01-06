// src/handlers/callbackHandlers/callbackRouter.ts

import { MyContext } from "../../types.js";
import { ADMIN_ID } from "../../config.js";
import { fastCheckPhase } from "../../utils/updatePhase.js";
import { handleSubjectSelectionCallback, handleChangeSubjectsCallback } from "./handleUserRegisrationCallback.js";
import { handleAdminRegistrationCallback } from "./handleAdminRegistrationCallback.js";
import { handleAdminPreparationCallback } from "./handleAdminPreparationCallback.js";

export async function handleCallbackQuery(ctx: MyContext): Promise<void> {
  const currentPhase = await fastCheckPhase();
  const callbackData = ctx.callbackQuery?.data;
  const userState = ctx.session.user.state;
  const isAdmin = ctx.from?.id === ADMIN_ID;
  const chatType = ctx.chat?.type;

  if (userState === "awaiting_subject_selection" && chatType === "private" && currentPhase === "registration") {
    await handleSubjectSelectionCallback(ctx);
    return;
  }

  if (callbackData === "change_subjects" && chatType === "private" && currentPhase === "registration") {
      await handleChangeSubjectsCallback(ctx);
      return;
  }

  if (currentPhase === "registration" && isAdmin && chatType === "private" && currentPhase === "registration") {
    await handleAdminRegistrationCallback(ctx);
    return;
  }

  if (isAdmin && chatType === "private" && currentPhase === "preparation"){
    await handleAdminPreparationCallback(ctx);
    return;
  }

  await ctx.answerCallbackQuery({
    text: "❌ Неверная команда или время действия кнопки истекло, также возможно сейчас идёт переход на новый этап, ждите",
    show_alert: true
  });
}