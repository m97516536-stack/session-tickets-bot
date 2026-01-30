// src/storage/usersStorage.ts

import { UserRecord } from "../types.js";
import { readJson, writeJson } from "./jsonStorage.js";
import { USERS_FILE } from "../config.js";

/**
 * Операции с данными пользователей.
 */

/**
 * Возвращает запись пользователя по Telegram ID.
 * @param {number} telegramId - ID пользователя
 * @returns {Promise<UserRecord | null>}
 */
export async function getUser(telegramId: number): Promise<UserRecord | null> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  return users[String(telegramId)] ?? null;
}

/**
 * Сохраняет ФИ пользователя (или создаёт запись при первом обращении).
 * @param {number} telegramId - ID пользователя
 * @param {string} fio - фамилия и имя
 * @returns {Promise<void>}
 */
export async function saveUser(telegramId: number, fio: string): Promise<void> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const userId = String(telegramId);
  
  if (!users[userId]) {
    users[userId] = {
      telegramId,
      fio,
      registeredAt: new Date().toISOString(),
    };
  } else {
    users[userId].fio = fio;
  }

  await writeJson(USERS_FILE, users);
}

/**
 * Сохраняет список выбранных пользователем предметов.
 * @param {number} telegramId - ID пользователя
 * @param {string} subjects - массив названий предметов
 * @returns {Promise<void>}
 */
export async function saveUserSubjects(telegramId: number, subjects: string[]): Promise<void> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const userId = String(telegramId);

  if (users[userId]) {
    users[userId].subjects = subjects;
  } else {
    users[userId] = {
      telegramId,
      fio: "Неизвестно",
      registeredAt: new Date().toISOString(),
      subjects,
      assignedTickets: {},
    };
  }

  await writeJson(USERS_FILE, users);
}