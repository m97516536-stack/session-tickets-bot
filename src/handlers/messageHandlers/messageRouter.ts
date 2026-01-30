// src/handlers/messageHandlers/messageRouter.ts

import { MyContext } from "../../types.js";
import { ADMIN_ID } from "../../config.js";
import { fastCheckPhase } from "../../utils/updatePhase.js";
import { handleSubjectInput } from "./handleSubjectInput.js";
import { handleFioInput } from "./handleFioInput.js";
import { handleDateInput } from "./handleDateInput.js";
import { handleTicketSubmission } from "./handleTicketSubmission.js";
import { handleRevisionComment, handleFileReplacement } from "./handleEditorActions.js";

/**
 * Маршрутизатор сообщений: направляет входящие сообщения в нужные обработчики по фазе и состоянию.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleMessage(ctx: MyContext): Promise<void> {
  const currentPhase = await fastCheckPhase();
  const isAdmin = ctx.from?.id === ADMIN_ID;
  const adminState = ctx.session.admin.state;
  const userState = ctx.session.user.state;
  const editorState = ctx.session.editor;
  const chatType = ctx.chat?.type;

  if (isAdmin && adminState === "awaiting_subject_name" && chatType === "supergroup" && currentPhase === "preparation" && ctx.message?.text) {
    await handleSubjectInput(ctx);
    return;
  }

  if (userState === "awaiting_fio" && chatType === "private" && currentPhase === "registration" && ctx.message?.text) {
    await handleFioInput(ctx);
    return;
  }

  if (isAdmin && adminState?.startsWith("awaiting_") && chatType === "private" && currentPhase === "preparation" && ctx.message?.text) {
    await handleDateInput(ctx);
    return;
  }

   if (ctx.session.user.awaitingTicketSubmission && chatType === "private" && currentPhase === "ticketing" && ctx.message?.document) {
    await handleTicketSubmission(ctx);
    return;
  }

  if (editorState?.awaitingRevisionComment && chatType === "supergroup" && ctx.message?.text) {
    const { subject, ticketNumber } = editorState.awaitingRevisionComment;
    await handleRevisionComment(ctx, subject, ticketNumber, ctx.message.text);
    return;
  }

  if (editorState?.awaitingReplacementFile && chatType === "supergroup" && ctx.message?.document) {
    const { subject, ticketNumber } = editorState.awaitingReplacementFile;
    await handleFileReplacement(ctx, subject, ticketNumber, ctx.message.document.file_id);
    return;
  }

  return;
}