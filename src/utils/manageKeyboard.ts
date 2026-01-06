// src/utils/manageKeyboard.ts

import { Context, InlineKeyboard } from "grammy";
import { readJson, writeJson } from "../storage/jsonStorage.js";

interface KeyboardState {
  messageId: number;
  chatId: number;
}

interface KeyboardStorage {
  [key: string]: KeyboardState;
}

const KEYBOARD_STATES_FILE = "keyboardStates.json";

type KeyboardType = "user" | "admin" | "init";

/**
 * Универсальная функция для управления клавиатурой с сохранением состояний в файле.
 * Учитывает message_thread_id для супергрупп с темами.
 * @param ctx - Контекст бота
 * @param text - Текст сообщения
 * @param inlineKeyboard - Inline-клавиатура
 * @param type - Тип клавиатуры (для идентификации)
 * @param forceNew - Принудительно создать новое сообщение (например, при вводе текста)
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