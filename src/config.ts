// src/config.ts

import "dotenv/config";

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`❌ Переменная окружения ${name} не задана в .env`);
  }
  return value;
}

export const BOT_TOKEN = getEnvVar("BOT_TOKEN");
export const ADMIN_ID = parseInt(getEnvVar("ADMIN_ID"), 10);
export const SUPERGROUP_ID = parseInt(getEnvVar("SUPERGROUP_ID"), 10);
export const SPREADSHEET_ID = getEnvVar("SPREADSHEET_ID");

export const SESSIONS_FILE = "user_sessions.json";
export const USERS_FILE = "users.json";
export const CREDENTIALS_PATH = "./credentials.json";
export const SUBJECTS_DATA_FILE = "subjects_data.json";