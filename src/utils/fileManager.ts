// src/utils/fileManager.ts

import { Api } from "grammy";
import { writeFile, mkdir, readdir, stat } from "fs/promises";
import { join, extname } from "path";
import { BOT_TOKEN } from "../config.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { SUBJECTS_DATA_FILE } from "../config.js";
import { AllSubjectsData } from "../types.js";

const TICKETS_DIR = join(process.cwd(), "data", "tickets");

/**
 * Создаёт директорию для хранения билетов, если её нет.
 * @returns {Promise<void>}
 */
export async function ensureTicketsDir(): Promise<void> {
  await mkdir(TICKETS_DIR, { recursive: true });
}

/**
 * Очищает название предмета для безопасного использования в имени файла.
 * Заменяет недопустимые символы и пробелы на подчёркивания.
 * @param {string} subject - Название предмета
 * @returns {string} Безопасное имя для файловой системы
 */
export function sanitizeSubjectName(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/[\/\\<>:"|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .trim()
    .replace(/^_+|_+$/g, "");
}

/**
 * Получает номер последней версии файла билета.
 * @param {string} subject - Название предмета
 * @param {number} ticketNumber - Номер билета
 * @returns {Promise<number>} Номер последней версии или 0, если файлов нет
 */
export async function getLatestTicketVersion(subject: string, ticketNumber: number): Promise<number> {
  await ensureTicketsDir();
  const safeSubject = sanitizeSubjectName(subject);
  const prefix = `${ticketNumber}_${safeSubject}_v`;
  
  try {
    const files = await readdir(TICKETS_DIR);
    const versions = files
      .filter(f => f.startsWith(prefix))
      .map(f => {
        const match = f.match(new RegExp(`${prefix}(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(v => !isNaN(v) && v > 0);
    
    return versions.length > 0 ? Math.max(...versions) : 0;
  } catch (err) {
    console.error(`Ошибка при получении версии билета ${ticketNumber} (${subject}):`, err);
    return 0;
  }
}

/**
 * Возвращает путь к файлу последней версии билета.
 * @param {string} subject - Название предмета
 * @param {number} ticketNumber - Номер билета
 * @returns {Promise<string | null>} Путь к файлу или null, если файл не существует
 */
export async function getLatestTicketFilePath(subject: string, ticketNumber: number): Promise<string | null> {
  const version = await getLatestTicketVersion(subject, ticketNumber);
  if (version === 0) return null;
  
  const safeSubject = sanitizeSubjectName(subject);
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const subjectData = subjectsData[subject];
  if (!subjectData) return null;
  
  const question = subjectData.questions.find(q => q.number === ticketNumber);
  if (!question?.fileExtension) return null;
  
  const filename = `${ticketNumber}_${safeSubject}_v${version}${question.fileExtension}`;
  const filePath = join(TICKETS_DIR, filename);

  try {
    await stat(filePath);
    return filePath;
  } catch {
    console.warn(`Файл не найден: ${filePath}`);
    return null;
  }
}

/**
 * Скачивает и сохраняет файл билета локально с версионированием.
 * Имя файла: `{номер}_{предмет}_v{версия}{расширение}`
 * @param {Api} api - Экземпляр Telegram API
 * @param {string} fileId - ID файла в Telegram
 * @param {string} subject - Название предмета
 * @param {number} ticketNumber - Номер билета
 * @returns {Promise<{ version: number; filePath: string; extension: string }>}
 */
export async function downloadAndSaveTicketFile(
  api: Api,
  fileId: string,
  subject: string,
  ticketNumber: number
): Promise<{ version: number; filePath: string; extension: string }> {
  await ensureTicketsDir();

  const file = await api.getFile(fileId);
  if (!file.file_path) {
    throw new Error(`Не удалось получить путь к файлу ${fileId}`);
  }
  
  const extension = extname(file.file_path) || ".bin";
  
  const currentVersion = await getLatestTicketVersion(subject, ticketNumber);
  const newVersion = currentVersion + 1;
  const safeSubject = sanitizeSubjectName(subject);
  const filename = `${ticketNumber}_${safeSubject}_v${newVersion}${extension}`;
  const filePath = join(TICKETS_DIR, filename);
  
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ошибка скачивания файла: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  await writeFile(filePath, buffer);
  
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const subjectData = subjectsData[subject];
  if (!subjectData) {
    throw new Error(`Предмет "${subject}" не найден в данных`);
  }
  
  const question = subjectData.questions.find(q => q.number === ticketNumber);
  if (!question) {
    throw new Error(`Вопрос №${ticketNumber} не найден в предмете "${subject}"`);
  }
  
  question.fileVersion = newVersion;
  question.fileExtension = extension;
  question.fileId = fileId;
  
  await writeJson(SUBJECTS_DATA_FILE, subjectsData);
  
  return { version: newVersion, filePath, extension };
}