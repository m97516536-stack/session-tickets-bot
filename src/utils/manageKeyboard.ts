// src/utils/manageKeyboard.ts

import { Context, InlineKeyboard } from "grammy";

interface KeyboardState {
  messageId: number;
  chatId: number;
}

const keyboardStates = new Map<string, KeyboardState>();

type KeyboardType = "user" | "admin" | "init";

/**
 * Универсальная функция для управления клавиатурой.
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

  const chatId = ctx.chat?.id;
  const stateKey = `${chatId}:${type}`;

  const existingState = keyboardStates.get(stateKey);

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
      console.error("Failed to edit message, removing from cache:", err);
      keyboardStates.delete(stateKey);
    }
  }

  if (existingState && forceNew) {
    try {
      await ctx.api.deleteMessage(existingState.chatId, existingState.messageId);
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
    keyboardStates.delete(stateKey);
  }

  const sentMessage = await ctx.reply(text, { reply_markup: inlineKeyboard });
  if (sentMessage.message_id) {
    keyboardStates.set(stateKey, {
      messageId: sentMessage.message_id,
      chatId: chatId,
    });
  }
}