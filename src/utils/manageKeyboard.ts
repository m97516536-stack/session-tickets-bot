// src/utils/manageKeyboard.ts

import { Bot, Context, InlineKeyboard } from "grammy";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { KEYBOARD_STATES_FILE, USERS_FILE } from "../config.js";
import { MyContext } from "../types.js";

interface KeyboardState {
  messageId: number;
  chatId: number;
  lastUpdated: number;
}

interface KeyboardStorage {
  [key: string]: KeyboardState;
}

type KeyboardType = "user" | "admin" | "editor";

/**
 * Управляет сообщением с клавиатурой: редактирует или создаёт новое.
 * @param {Context} ctx - контекст бота
 * @param {string} text - текст сообщения
 * @param {InlineKeyboard} [inlineKeyboard] - клавиатура (опционально)
 * @param {"user" | "admin" | "editor"} [type="user"] - тип состояния
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
  if (!ctx.chat || (ctx.chat.type !== "private")) return;

  const chatId = ctx.chat.id;
  const threadId = ctx.msg?.message_thread_id;
  const stateKey = threadId !== undefined ? `${chatId}:${threadId}:${type}` : `${chatId}:${type}`;
  const now = Date.now();

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

      keyboardStates[stateKey] = {
        ...existingState,
        lastUpdated: now
      };
      await writeJson(KEYBOARD_STATES_FILE, keyboardStates);
      return;
    } catch (err: any) {
      if (err?.description?.includes("message is not modified")) {
        console.log(`ℹ️ Сообщение не изменилось для ${stateKey}, пропускаем`);
        return;
      }

      console.error("Ошибка редактирования сообщения:", err);
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
      lastUpdated: now
    };
    await writeJson(KEYBOARD_STATES_FILE, keyboardStates);
  }
}

/**
 * Удаляет клавиатуры, которые не обновлялись более 6 часов.
 * @param {Bot} bot - экземпляр бота
 * @returns {Promise<void>}
 */
export async function cleanupOldKeyboards(bot: Bot<MyContext>): Promise<void> {
  try {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const now = Date.now();
    
    const keyboardStates = await readJson<KeyboardStorage>(KEYBOARD_STATES_FILE);
    const newKeyboardStates: KeyboardStorage = {};
    let removedCount = 0;

    for (const [stateKey, state] of Object.entries(keyboardStates)) {
      if (state.lastUpdated && (now - state.lastUpdated) < SIX_HOURS) {
        newKeyboardStates[stateKey] = state;
        continue;
      }

      try {
        await bot.api.deleteMessage(state.chatId, state.messageId);
        console.log(`🗑️ Удалена старая клавиатура для ${stateKey} (возраст: ${(now - state.lastUpdated) / 3600000} часов)`);
        removedCount++;
      } catch (deleteError) {
        const errorMessage = deleteError instanceof Error 
          ? deleteError.message 
          : 'Неизвестная ошибка';

        if (!errorMessage.toLowerCase().includes('not found') && 
            !errorMessage.includes('400')) {
          console.warn(`⚠️ Не удалось удалить старую клавиатуру ${stateKey}:`, deleteError);
        }
      }
    }

    if (removedCount > 0) {
      await writeJson(KEYBOARD_STATES_FILE, newKeyboardStates);
      console.log(`✅ Очищено ${removedCount} старых клавиатур. Осталось: ${Object.keys(newKeyboardStates).length}`);
    }
  } catch (error) {
    console.error("❌ Ошибка при очистке старых клавиатур:", error);
  }
}

/**
 * Удаляет клавиатуры пользователей, которых больше нет в базе данных.
 * @param {Bot<MyContext>} bot - экземпляр бота
 * @returns {Promise<void>}
 */
export async function cleanupNonExistentUserKeyboards(bot: Bot<MyContext>): Promise<void> {
  try {
    const keyboardStates = await readJson<KeyboardStorage>(KEYBOARD_STATES_FILE);
    const users = await readJson<Record<string, any>>(USERS_FILE);
    const newKeyboardStates: KeyboardStorage = {};
    let removedCount = 0;

    for (const [stateKey, state] of Object.entries(keyboardStates)) {
      const parts = stateKey.split(':');
      const chatIdStr = parts[0];

      const userId = chatIdStr;
      const userExists = users[userId] !== undefined;

      if (!userExists) {
        try {
          await bot.api.deleteMessage(state.chatId, state.messageId);
          console.log(`🗑️ Удалена клавиатура несуществующего пользователя ${userId}`);
          removedCount++;
        } catch (deleteError) {
          const errorMessage = deleteError instanceof Error 
            ? deleteError.message 
            : 'Неизвестная ошибка';
            
          if (!errorMessage.toLowerCase().includes('not found') && 
              !errorMessage.includes('400')) {
            console.warn(`⚠️ Не удалось удалить клавиатуру несуществующего пользователя ${userId}:`, deleteError);
          }
        }
        continue;
      }

      newKeyboardStates[stateKey] = state;
    }

    if (removedCount > 0) {
      await writeJson(KEYBOARD_STATES_FILE, newKeyboardStates);
      console.log(`✅ Очищено ${removedCount} клавиатур несуществующих пользователей`);
    }
  } catch (error) {
    console.error("❌ Ошибка при очистке клавиатур несуществующих пользователей:", error);
  }
}

/**
 * Запускает периодическую очистку старых клавиатур каждые 30 минут.
 * @param {Bot} bot - экземпляр бота
 * @returns {void}
 */
export function startKeyboardCleanup(bot: Bot<MyContext>): void {
  const cleanupTask = async () => {
    await cleanupOldKeyboards(bot);
    await cleanupNonExistentUserKeyboards(bot);
  };

  setTimeout(() => {
    cleanupTask();
    setInterval(cleanupTask, 30 * 60 * 1000);
  }, 5 * 60 * 1000);
  
  console.log("🧹 Запущена периодическая очистка клавиатур (каждые 30 минут)");
}