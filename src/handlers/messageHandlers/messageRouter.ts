// src/handlers/messageHandlers/messageRouter.ts

import { MyContext } from "../../types.js";
import { ADMIN_ID } from "../../config.js";
import { fastCheckPhase } from "../../utils/updatePhase.js";
import { handleSubjectInput } from "./handleSubjectInput.js";
import { handleFioInput } from "./handleFioInput.js";
import { handleDateInput } from "./handleDateInput.js";

export async function handleMessage(ctx: MyContext): Promise<void> {
  const currentPhase = await fastCheckPhase();
  const isAdmin = ctx.from?.id === ADMIN_ID;
  const adminState = ctx.session.admin.state;
  const userState = ctx.session.user.state;
  const chatType = ctx.chat?.type;

  if (isAdmin && adminState === "awaiting_subject_name" && chatType === "supergroup" && currentPhase === "preparation") {
    await handleSubjectInput(ctx);
    return;
  }

  if (userState === "awaiting_fio" && chatType === "private" && currentPhase === "registration") {
    await handleFioInput(ctx);
    return;
  }

  if (isAdmin && adminState?.startsWith("awaiting_") && chatType === "private" && currentPhase === "preparation") {
    await handleDateInput(ctx);
    return;
  }

  return;
}