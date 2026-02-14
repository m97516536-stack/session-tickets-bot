// src/handlers/messageHandlers/messageRouter.ts

import { MyContext } from "../../types.js";
import { ADMIN_IDS } from "../../config.js";
import { fastCheckPhase } from "../../utils/updatePhase.js";
import { handleFioInput } from "./handleFioInput.js";
import { handleDateInput } from "./handleDateInput.js";
import { handleTicketSubmission } from "./handleTicketSubmission.js";
import { handleSubjectInput } from "./handleSubjectInput.js";
import { handleEditorFioInput } from "./handleEditorFioInput.js";
import { handleRemoveEditorFioInput } from "./handleRemoveEditorFioInput.js";
import { handleEditorTicketingActions } from "./handleEditorTicketingActions.js";
import { handleAdminSpam } from "./handleAdminSpam.js";
import { handleNewSubjectInput } from "./handleNewSubjectInput.js";


/**
 * Маршрутизатор сообщений: направляет входящие сообщения в нужные обработчики по фазе и состоянию.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleMessage(ctx: MyContext): Promise<void> {
  if (ctx.chat?.type != "private") return;

  const currentPhase = await fastCheckPhase();
  const isAdmin = ctx.from?.id !== undefined && ADMIN_IDS.includes(ctx.from.id);
  const adminState = ctx.session.admin.state;
  const userState = ctx.session.user.state;
  const spamData = ctx.session.admin.spam;

  if (isAdmin && adminState === "awaiting_subject_name" && (currentPhase === "preparation" ||  currentPhase === "registration") && ctx.message?.text) {
    await handleSubjectInput(ctx);
    return;
  }

  if (isAdmin && adminState?.startsWith("awaiting_") && currentPhase === "preparation" && ctx.message?.text) {
    await handleDateInput(ctx);
    return;
  }

  if (isAdmin && spamData && ctx.message && currentPhase != "preparation") {
    await handleAdminSpam(ctx);
    return;
  }

  if (isAdmin && adminState === "awaiting_editor_fio" && currentPhase === "registration" && ctx.message?.text) {
    await handleEditorFioInput(ctx);
    return;
  }

  if (isAdmin && adminState === "awaiting_remove_editor_fio" && currentPhase === "registration" && ctx.message?.text) {
    await handleRemoveEditorFioInput(ctx);
    return;
  }

  if (userState === "awaiting_fio" && currentPhase === "registration" && ctx.message?.text) {
    await handleFioInput(ctx);
    return;
  }

  if (isAdmin && adminState === "awaiting_new_subject_name" && (currentPhase === "editing" || currentPhase === "ticketing" || currentPhase === "finished") && ctx.message?.text) {
    await handleNewSubjectInput(ctx);
    return;
  }

  if (ctx.session.user.awaitingTicketSubmission && (currentPhase === "ticketing" || currentPhase === "finished") && ctx.message?.document) {
    await handleTicketSubmission(ctx);
    return;
  }

  if ((ctx.session.editor.awaitingRevisionComment || ctx.session.editor.awaitingReplacementFile) && (currentPhase === "ticketing" || currentPhase === "finished")) {
    await handleEditorTicketingActions(ctx);
    return;
  }

  return;
}