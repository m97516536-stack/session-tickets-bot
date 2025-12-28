// src/storage/users.ts
import { UserRecord } from "../types.js";
import { readJson, writeJson } from "./jsonStorage.js";
import { USERS_FILE } from "../config.js";

export async function getUser(telegramId: number): Promise<UserRecord | null> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  return users[String(telegramId)] ?? null;
}

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

export async function saveUserSubjects(telegramId: number, subjects: string[]): Promise<void> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const userId = String(telegramId);

  if (users[userId]) {
    users[userId].subjects = subjects;
  } else {
    // На всякий случай: если вдруг нет записи (маловероятно, но безопасно)
    users[userId] = {
      telegramId,
      fio: "Неизвестно",
      registeredAt: new Date().toISOString(),
      subjects,
    };
  }

  await writeJson(USERS_FILE, users);
}