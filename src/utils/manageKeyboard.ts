// src/utils/manageKeyboard.ts

import { Context, InlineKeyboard } from "grammy";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { KEYBOARD_STATES_FILE } from "../config.js";

interface KeyboardState {
  messageId: number;
  chatId: number;
}

interface KeyboardStorage {
  [key: string]: KeyboardState;
}

type KeyboardType = "user" | "admin" | "init";

/**
 * Управляет сообщением с клавиатурой: редактирует или создаёт новое.
 * @param {Context} ctx - контекст бота
 * @param {string} text - текст сообщения
 * @param {InlineKeyboard} [inlineKeyboard] - клавиатура (опционально)
 * @param {"user" | "admin" | "init"} [type="user"] - тип состояния
 * @param {boolean} [forceNew=false] - принудительно создать новое сообщение
 * @returns {Promise<void>}
 */
export async function manageKeyboard(
  ctx: Context,
  text: string,
  inlineKeyboard?: InlineKeyboard,
  type: KeyboardType = "user",
  forceNew = false
) {
  if (!ctx.chat || (ctx.chat.type !== "private" && ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) return;

  const chatId = ctx.chat.id;
  const threadId = ctx.msg?.message_thread_id;
  const stateKey = threadId !== undefined ? `${chatId}:${threadId}:${type}` : `${chatId}:${type}`;

  let keyboardStates = await readJson<KeyboardStorage>(KEYBOARD_STATES_FILE);
  const existingState = keyboardStates[stateKey];

  if (existingState && !forceNew) {
    try {
      await ctx.api.editMessageText(
        existingState.chatId,
        existingState.messageId,
        text,
        { reply_markup: inlineKeyboard }
      );
      return;
    } catch (err) {
      console.error("Failed to edit message, removing from storage:", err);
      delete keyboardStates[stateKey];
      await writeJson(KEYBOARD_STATES_FILE, keyboardStates);
    }
  }

  if (existingState && forceNew) {
    try {
      await ctx.api.deleteMessage(existingState.chatId, existingState.messageId);
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
    delete keyboardStates[stateKey];
    await writeJson(KEYBOARD_STATES_FILE, keyboardStates);
  }

  const sentMessage = await ctx.reply(text, { reply_markup: inlineKeyboard });
  if (sentMessage.message_id) {
    keyboardStates[stateKey] = {
      messageId: sentMessage.message_id,
      chatId: chatId,
    };
    await writeJson(KEYBOARD_STATES_FILE, keyboardStates);
  }
}