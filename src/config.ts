// src/config.ts

import "dotenv/config";

/**
 * Конфигурация бота: обязательные переменные окружения и пути к локальным файлам.
 *
 * @exports
 * - BOT_TOKEN: string — токен бота
 * - ADMIN_ID: number — ID админа
 * - SPREADSHEET_ID: string — ID таблицы
 * - SESSIONS_FILE: string — файл хранения сессий пользователей
 * - USERS_FILE: string — файл с данными зарегистрированных пользователей
 * - CREDENTIALS_PATH: string — путь к OAuth2-ключам Google API
 * - SUBJECTS_DATA_FILE: string — файл с вопросами по предметам и статусами билетов
 * - PHASE_CONFIG_FILE: string — файл с текущей фазой и дедлайнами
 * - KEYBOARD_STATES_FILE: string — файл состояний клавиатур по чатам
 * - EDITOR_REQUESTS_FILE: string — временный файл для с желающми быть редакторами
 * - EDITOR_MESSAGES_FILE: string — файл состояний сообщений с билетами
 * 
 * @throws {Error} если любая из переменных окружения не задана в .env
 */

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`❌ Переменная окружения ${name} не задана в .env`);
  }
  return value;
}

export const BOT_TOKEN = getEnvVar("BOT_TOKEN");
export const ADMIN_IDS = getEnvVar("ADMIN_IDS")
  .split(',')
  .map(id => id.trim())
  .filter(id => id !== '')
  .map(id => parseInt(id, 10))
  .filter(id => !isNaN(id));
export const SPREADSHEET_ID = getEnvVar("SPREADSHEET_ID");

export const SESSIONS_FILE = "user_sessions.json";
export const USERS_FILE = "users.json";
export const CREDENTIALS_PATH = "./credentials.json";
export const SUBJECTS_DATA_FILE = "subjects_data.json";
export const PHASE_CONFIG_FILE = "phases.json";
export const KEYBOARD_STATES_FILE = "keyboardStates.json";
export const EDITOR_REQUESTS_FILE = "editor_requests.json";
export const EDITOR_MESSAGES_FILE = "editor_messages.json";