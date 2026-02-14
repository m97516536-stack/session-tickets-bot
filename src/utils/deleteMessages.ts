// src/utils/messageUtils.ts

import { Api } from "grammy";

/**
 * Удаляет служебные сообщения (промпты, временные сообщения).
 * Безопасно игнорирует ошибки (сообщение могло быть удалено вручную).
 * @param api - экземпляр Telegram API
 * @param chatId - ID чата
 * @param messageIds - ID сообщений для удаления
 */
export async function deleteMessages(
  api: Api,
  chatId: number | undefined,
  ...messageIds: (number | undefined)[]
): Promise<void> {
  if (!chatId) return;
  for (const id of messageIds) {
    if (id) {
      try {
        await api.deleteMessage(chatId, id);
      } catch (e) {
        // Игнорируем ошибки — сообщение могло быть удалено пользователем или истекло
      }
    }
  }
}