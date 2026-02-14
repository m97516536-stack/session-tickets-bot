// src/utils/broadcast.ts

import { Api } from "grammy";
import { InputFile } from "grammy";

/**
 * Результат рассылки сообщения.
 */
export interface BroadcastResult {
  total: number;
  success: number;
  failed: number;
  failedUsers: number[];
}

/**
 * Отправляет сообщение (с файлами или без) нескольким пользователям.
 * Возвращает статистику рассылки.
 * @param api - экземпляр Telegram API
 * @param userIds - массив ID пользователей для рассылки
 * @param text - текст сообщения
 * @param filePaths - опционально: путь к файлу или массив путей к файлам
 * @returns статистика рассылки
 */
export async function broadcastMessage(
  api: Api,
  userIds: number[],
  text: string,
  filePaths?: string | string[]
): Promise<BroadcastResult> {
  const result: BroadcastResult = {
    total: userIds.length,
    success: 0,
    failed: 0,
    failedUsers: [],
  };

  const files: string[] = filePaths 
    ? (Array.isArray(filePaths) ? filePaths : [filePaths])
    : [];

  const sendFileBatches = async (userId: number, files: string[]): Promise<void> => {
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      if (batch.length === 1) {
        await api.sendDocument(userId, new InputFile(batch[0]));
      } else {
        const media = batch.map(path => ({
          type: "document" as const,
          media: new InputFile(path),
        }));
        await api.sendMediaGroup(userId, media);
      }
    }
  };

  for (const userId of userIds) {
    try {
      if (files.length === 0) {
        await api.sendMessage(userId, text);
      } else if (files.length === 1) {
        await api.sendDocument(
          userId,
          new InputFile(files[0]),
          { caption: text }
        );
      } else {
        await sendFileBatches(userId, files);
        await api.sendMessage(userId, text);
      }

      result.success++;
    } catch (error) {
      console.warn(`Не удалось отправить сообщение пользователю ${userId}:`, error);
      result.failed++;
      result.failedUsers.push(userId);
    }
  }

  return result;
}