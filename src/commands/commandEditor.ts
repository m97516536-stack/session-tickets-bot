// src/commands/commandEditor.ts

import { MyContext, UserRecord } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { fastCheckPhase } from "../utils/updatePhase.js";
import { readJson } from "../storage/jsonStorage.js";
import { USERS_FILE } from "../config.js";
import { getEditorTicketsText, keyboardEditorSelectTicket } from "../keyboards/keyboardEditorTicketing.js";

/**
 * Обрабатывает команду /editor: показывает меню редактора только для авторизованных редакторов.
 * Доступна только на этапах "ticketing" и "finished".
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function commandEditor(ctx: MyContext) {
  if (ctx.chat?.type !== "private") return;

  const userId = String(ctx.from?.id);
  if (!userId) return;

  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const user = users[userId];

  const isEditor = user?.editor === true;
  
  if (!isEditor) {
    return;
  }

  const currentPhase = await fastCheckPhase();

  if (currentPhase !== "ticketing" && currentPhase !== "finished") {
    return;
  }

  const text = await getEditorTicketsText(user);
  const keyboard = await keyboardEditorSelectTicket(user);

  await manageKeyboard(
    ctx,
    text,
    keyboard,
    "editor",
    true
  );
}