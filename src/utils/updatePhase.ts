// src/utils/updatePhase.ts
// Возможно потом переписать под более умную логику для меньшей нагрузки

import { bot } from "../bot.js";
import { updateAllKeyboards } from "./updateKeyboards.js";
import { distributeTickets } from "./distributeTickets.js";

import { PhaseConfig, UserRecord, MySession } from "../types.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { PHASE_CONFIG_FILE, USERS_FILE, SESSIONS_FILE, KEYBOARD_STATES_FILE } from "../config.js";

/**
 * Обновляет текущую фазу на основе дедлайнов в конфигурации.
 * @param {PhaseConfig} config - конфигурация с дедлайнами
 * @returns {void}
 */
export function updateCurrentPhase(config: PhaseConfig): void {
  const now = new Date();

  if (!config.deadlines) {
    config.currentPhase = "preparation";
    return;
  }

  const regEnd = new Date(config.deadlines.registrationEnd);
  const editEnd = new Date(config.deadlines.editingEnd);
  const tickEnd = new Date(config.deadlines.ticketingEnd);

  regEnd.setHours(23, 0, 0, 0);
  editEnd.setHours(23, 0, 0, 0);
  tickEnd.setHours(23, 0, 0, 0);

  if (now < regEnd) {
    config.currentPhase = "registration";
  } else if (now < editEnd) {
    config.currentPhase = "editing";
  } else if (now < tickEnd) {
    config.currentPhase = "ticketing";
  } else {
    config.currentPhase = "finished";
  }
}

/**
 * Проверяет и обновляет фазу, применяя побочные эффекты при переходе.
 * @returns {Promise<PhaseConfig["currentPhase"]>}
 */
async function updatePhaseAndWriteIfChanged(): Promise<PhaseConfig["currentPhase"]> {
  let config = await readJson<PhaseConfig>(PHASE_CONFIG_FILE);

  const oldPhase = config.currentPhase;

  updateCurrentPhase(config);

  if (oldPhase !== config.currentPhase) {
    if (oldPhase === "registration" && config.currentPhase === "editing") {
      try {
        console.log("🎯 Запуск автоматического распределения билетов...");
        await distributeTickets();
        console.log("✅ Распределение билетов успешно завершено!");
      } catch (error) {
        console.error("❌ КРИТИЧЕСКАЯ ОШИБКА при распределении билетов:", error);

        config.currentPhase = oldPhase;
        console.log(`⚠️ Фаза сохранена как "${oldPhase}" из-за ошибки распределения`);

        await writeJson(PHASE_CONFIG_FILE, config);

        return config.currentPhase;
      }
    }

    if (oldPhase === "editing" && config.currentPhase === "ticketing") {
      try {
        console.log("🧹 Запуск очистки незарегистрированных пользователей...");
        
        const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
        const validUsers: Record<string, UserRecord> = {};
        const removedUsers: { id: string; fio: string }[] = [];
        
        for (const [userId, user] of Object.entries(users)) {
          const isValidUser = user.fio?.trim() && user.subjects?.length && user.subjects.length > 0;

          if (isValidUser) {
            validUsers[userId] = user;
          } else {
            removedUsers.push({ id: userId, fio: user.fio || 'Безымянный' });
            console.log(`🗑️ Удаляю пользователя: ${user.fio || 'Безымянный'} (ID: ${userId})`);
          }
        }

        await writeJson(USERS_FILE, validUsers);

        if (removedUsers.length > 0) {
          const sessions = await readJson<Record<string, MySession>>(SESSIONS_FILE);
          const validSessions: Record<string, MySession> = {};
          
          for (const [sessionId, session] of Object.entries(sessions)) {
            if (validUsers[sessionId]) {
              validSessions[sessionId] = session;
            }
          }
          
          await writeJson(SESSIONS_FILE, validSessions);
          console.log(`🧹 Удалено сессий: ${removedUsers.length}`);
        }
        
        if (removedUsers.length > 0) {
          const keyboardStates = await readJson<Record<string, { messageId: number; chatId: number }>>(KEYBOARD_STATES_FILE);
          const validKeyboardStates: Record<string, { messageId: number; chatId: number }> = {};
          const removedKeyboardStates: string[] = [];
          
          for (const [stateKey, state] of Object.entries(keyboardStates)) {
            const chatIdStr = stateKey.split(':')[0];
            const chatId = parseInt(chatIdStr);
            
            const isUserValid = Object.values(validUsers).some(
              user => user.telegramId === chatId
            );
            
            if (isUserValid) {
              validKeyboardStates[stateKey] = state;
            } else {
              removedKeyboardStates.push(stateKey);
              console.log(`⌨️ Удаляю состояние клавиатуры: ${stateKey} (chatId: ${chatId})`);
            }
          }
          
          await writeJson(KEYBOARD_STATES_FILE, validKeyboardStates);
        }
        
        console.log(`✅ Очистка завершена! Удалено пользователей: ${removedUsers.length}`);
        if (removedUsers.length > 0) {
          console.log(`📝 Список удаленных: ${removedUsers.map(u => `${u.fio} (${u.id})`).join(', ')}`);
        }
      } catch (error) {
        console.error("❌ КРИТИЧЕСКАЯ ОШИБКА при очистке пользователей:", error);
        
        config.currentPhase = oldPhase;
        console.log(`⚠️ Фаза сохранена как "${oldPhase}" из-за ошибки очистки`);
        
        await writeJson(PHASE_CONFIG_FILE, config);
        
        return config.currentPhase;
      }
    }

    await writeJson(PHASE_CONFIG_FILE, config);
    console.log(`🔄 Фаза изменена с "${oldPhase}" на "${config.currentPhase}"`);

    await updateAllKeyboards(bot, config.currentPhase);
  }

  if (oldPhase !== config.currentPhase) {
    await writeJson(PHASE_CONFIG_FILE, config);
    console.log(`🔄 Фаза изменена с "${oldPhase}" на "${config.currentPhase}"`);
  }

  return config.currentPhase;
}

/**
 * Запускает фоновый таймер проверки фазы каждую минуту.
 * @returns {Promise<void>}
 */
export async function startPhaseUpdater(): Promise<void> {
  setInterval(async () => {
    await updatePhaseAndWriteIfChanged();
  }, 60 * 1000);
}

/**
 * Принудительно проверяет и обновляет фазу один раз.
 * @returns {Promise<PhaseConfig["currentPhase"]>}
 */
export async function fastCheckPhase(): Promise<PhaseConfig["currentPhase"]> {
  try {
    return await updatePhaseAndWriteIfChanged();
  } catch (error) {
    console.error("❌ Ошибка при проверке фазы:", error);
    return undefined;
  }
}