// src/utils/updateKeyboards.ts

import { Bot } from "grammy";
import { MyContext, PhaseConfig } from "../types.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { /*KEYBOARD_STATES_FILE,*/ USERS_FILE } from "../config.js";
import { InlineKeyboard } from "grammy";
import { adminKeyboard_Preparation } from "../keyboards/keyboardAdminPreparation.js";
import { adminKeyboard_Registration } from "../keyboards/keyboardAdminRegistration.js";
import { adminKeyboard_Editing } from "../keyboards/keyboardAdminEditing.js";
import { userKeyboard_Registration } from "../keyboards/keyboardUserRegistration.js";

const KEYBOARD_STATES_FILE = "keyboardStates.json";

interface KeyboardState {
  messageId: number;
  chatId: number;
}

interface KeyboardStorage {
  [key: string]: KeyboardState;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function updateAllKeyboards(bot: Bot<MyContext>, currentPhase: PhaseConfig["currentPhase"]) {
  if (!currentPhase) {
    console.warn("⚠️ Попытка обновить клавиатуры без указанной фазы");
    return;
  }

  try {
    const keyboardStates = await readJson<KeyboardStorage>(KEYBOARD_STATES_FILE);
    const users = await readJson<Record<string, { telegramId: number; fio: string }>>(USERS_FILE);
    const newKeyboardStates: KeyboardStorage = {};
    let processedCount = 0;
    
    for (const [stateKey, state] of Object.entries(keyboardStates)) {
      const parts = stateKey.split(":");
      let chatId: number, threadId: number | undefined, type: string;
      
      if (parts.length === 2) {
        chatId = parseInt(parts[0]);
        threadId = undefined;
        type = parts[1];
      } else if (parts.length === 3) {
        chatId = parseInt(parts[0]);
        threadId = parseInt(parts[1]);
        type = parts[2];
      } else {
        console.error(`❌ Некорректный формат ключа состояния: ${stateKey}`);
        continue;
      }

      if (isNaN(chatId) || !state.messageId) {
        console.error(`❌ Некорректные данные для ${stateKey}: chatId=${chatId}, messageId=${state.messageId}`);
        continue;
      }

      let text = "";
      let keyboard: InlineKeyboard | undefined;
      
      if (type === "admin") {
        switch (currentPhase) {
          case "preparation":
            text = "🔧 Админ-панель (подготовительный этап)";
            keyboard = adminKeyboard_Preparation();
            break;
          case "registration":
            text = "📋 Админ-панель (этап регистрации)";
            keyboard = adminKeyboard_Registration();
            break;
          case "editing":
            text = "✏️ Админ-панель (этап редактирования)";
            keyboard = adminKeyboard_Editing();
            break;
          case "ticketing":
            text = "📝 Админ-панель (этап подготовки билетов)";
            break;
          case "finished":
            text = "✅ Админ-панель (всё завершено)";
            break;
          default:
            console.warn(`❓ Неизвестная фаза для админа: ${currentPhase}`);
            continue;
        }
      } 
      else if (type === "user") {
        const userId = String(chatId);
        const isRegistered = !!users[userId];
        
        switch (currentPhase) {
          case "registration":
            text = isRegistered 
              ? "📋 Меню регистрации" 
              : "Введите вашу фамилию и имя:";
            keyboard = isRegistered ? userKeyboard_Registration() : undefined;
            break;
          case "editing":
            text = "✏️ Сейчас идёт этап редактирования. Пожалуйста, дождитесь его окончания.";
            break;
          case "ticketing":
            text = "🎫 Сейчас идёт этап подготовки билетов.";
            break;
          case "finished":
            text = "✅ Все этапы завершены. Спасибо за участие!";
            break;
          default:
            console.warn(`❓ Неизвестная фаза для пользователя: ${currentPhase}`);
            continue;
        }
      } else {
        console.warn(`❓ Неизвестный тип клавиатуры "${type}" для ${stateKey}`);
        continue;
      }

      try {
        try {
          await bot.api.deleteMessage(chatId, state.messageId);
          console.log(`✅ Сообщение ${state.messageId} удалено в чате ${chatId}`);
        } catch (deleteError) {
          const errorMessage = deleteError instanceof Error 
            ? deleteError.message 
            : 'Неизвестная ошибка';

          if (!errorMessage.toLowerCase().includes('not found') && 
              !errorMessage.includes('400')) {
            console.warn(`⚠️ Не удалось удалить сообщение ${state.messageId}: ${errorMessage}`);
          }
        }

        const sentMessage = await bot.api.sendMessage(
          chatId,
          text,
          {
            reply_markup: keyboard,
            ...(threadId ? { message_thread_id: threadId } : {}),
          }
        );

        newKeyboardStates[stateKey] = {
          messageId: sentMessage.message_id,
          chatId: chatId,
        };

        processedCount++;
        console.log(`✅ Обновлена клавиатура для ${stateKey} (новое ID: ${sentMessage.message_id})`);

      } catch (error) {
        console.error(`❌ Ошибка при обновлении для ${stateKey}:`, 
          error instanceof Error ? error.message : error);

        newKeyboardStates[stateKey] = state;
      }

      await delay(100);
    }

    await writeJson(KEYBOARD_STATES_FILE, newKeyboardStates);
    console.log(`✅ Обновлены клавиатуры для ${processedCount}/${Object.keys(keyboardStates).length} чатов`);
    console.log(`💾 Новое состояние сохранено в ${KEYBOARD_STATES_FILE}`);
    
  } catch (error) {
    console.error("❌ Критическая ошибка при обновлении клавиатур:", 
      error instanceof Error ? error.message : error);
  }
}