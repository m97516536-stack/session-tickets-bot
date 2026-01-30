// src/storage/jsonStorage.ts

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

/**
 * Работа с JSON-файлами в папке ./data.
 */

/**
 * Создаёт директорию ./data, если не существует.
 * @returns {Promise<void>}
 */
export async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

/**
 * Читает JSON-файл из ./data.
 * @param {string} filename — имя файла (например, "users.json")
 * @returns {Promise<T>} распарсенный объект или {} при ошибке
 */
export async function readJson<T>(filename: string): Promise<T> {
  try {
    const data = await readFile(join(DATA_DIR, filename), "utf8");
    return JSON.parse(data) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Записывает данные в JSON-файл в ./data.
 * @param {string} filename — имя файла
 * @param {unknown} data — данные для сериализации
 * @returns {Promise<void>}
 */
export async function writeJson(filename: string, data: unknown): Promise<void> {
  await ensureDataDir();
  await writeFile(join(DATA_DIR, filename), JSON.stringify(data, null, 2), "utf8");
}