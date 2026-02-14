// src/handlers/callbackHandlers/callbackRouter.ts

import { MyContext, UserRecord } from "../../types.js";
import { ADMIN_IDS, USERS_FILE } from "../../config.js";
import { fastCheckPhase } from "../../utils/updatePhase.js";
import { handleSubjectSelectionCallback, handleChangeSubjectsCallback, handleEditorSubjectSelectionCallback, handleBecomeEditorCallback } from "./handleUserRegisrationCallback.js";
import { handleAdminRegistrationCallback } from "./handleAdminRegistrationCallback.js";
import { handleAdminPreparationCallback } from "./handleAdminPreparationCallback.js";
import { handleAdminEditingCallback } from "./handleAdminEditingCallback.js";
import { handleUserTicketingCallback } from "./handleUserTicketingCallback.js";
import { handleEditorTicketingCallback } from "./handleEditorTicketingCallback.js";
import { handleAdminTicketingCallback } from "./handleAdminTicketindCallback.js";
import { readJson } from "../../storage/jsonStorage.js";

/**
 * Маршрутизатор коллбэков: направляет запросы в нужные обработчики по фазе и ролям.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleCallbackQuery(ctx: MyContext): Promise<void> {
  if (ctx.chat?.type != "private") return;

  const userId = String(ctx.from?.id);
  if (!userId) return;

  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const user = users[userId];

  const currentPhase = await fastCheckPhase();
  const callbackData = ctx.callbackQuery?.data;
  const userState = ctx.session.user.state;
  const isAdmin = ctx.from?.id !== undefined && ADMIN_IDS.includes(ctx.from.id);
  const isEditor = user?.editor === true;
  const isUser = user?.assignedTickets && Object.values(user.assignedTickets).some(tickets => tickets.length > 0);

  if (currentPhase === "preparation" && isAdmin) {
    await handleAdminPreparationCallback(ctx);
  } else if (currentPhase === "registration") {
    if (isAdmin) await handleAdminRegistrationCallback(ctx);
    if (userState === "awaiting_subject_selection") {
      await handleSubjectSelectionCallback(ctx);
    } else if (callbackData === "change_subjects") {
      await handleChangeSubjectsCallback(ctx);
    } else if (userState === "awaiting_editor_subject_selection") {
      await handleEditorSubjectSelectionCallback(ctx);
    } else if (callbackData === "become_editor") {
      await handleBecomeEditorCallback(ctx);
    }
  } else if (currentPhase === "editing" && isAdmin) {
    await handleAdminEditingCallback(ctx);
  } else if (currentPhase === "finished" || currentPhase === "ticketing") {
    if (isAdmin) await handleAdminTicketingCallback(ctx);
    if (isEditor) await handleEditorTicketingCallback(ctx);
    if (isUser) await handleUserTicketingCallback(ctx);
  } else {
    await ctx.answerCallbackQuery({
      text: "❌ Неверная команда или время действия кнопки истекло, также возможно сейчас идёт переход на новый этап, ждите",
      show_alert: true
    });
  }
}