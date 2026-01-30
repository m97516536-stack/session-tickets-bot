// src/utils/manageTicketMessage.ts

import { Api, InlineKeyboard, InputFile } from "grammy";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { SUBJECTS_DATA_FILE, SUPERGROUP_ID } from "../config.js";
import { AllSubjectsData } from "../types.js";
import { getLatestTicketFilePath } from "./fileManager.js";
import { stat } from "fs/promises";

/**
 * Управляет сообщением с билетом в теме супергруппы.
 * @param {Api} api - Экземпляр Telegram API
 * @param {string} subject - Название предмета
 * @param {number} ticketNumber - Номер билета
 * @param {string} caption - Подпись к файлу
 * @param {InlineKeyboard} [keyboard] - Клавиатура (опционально)
 */
export async function manageTicketMessage(
  api: Api,
  subject: string,
  ticketNumber: number,
  caption: string,
  keyboard?: InlineKeyboard
): Promise<void> {
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const subjectData = subjectsData[subject];
  
  if (!subjectData) {
    throw new Error(`Предмет "${subject}" не найден в данных`);
  }
  
  if (!subjectData.chatId) {
    throw new Error(`ID темы для предмета "${subject}" не указан`);
  }
  
  const threadId = Number(subjectData.chatId);
  const question = subjectData.questions.find(q => q.number === ticketNumber);
  
  if (!question) {
    throw new Error(`Вопрос №${ticketNumber} не найден в предмете "${subject}"`);
  }
  
  const filePath = await getLatestTicketFilePath(subject, ticketNumber);

  if (question.messageId) {
    try {
      await api.deleteMessage(SUPERGROUP_ID, question.messageId);
    } catch (e) {
      console.warn(`⚠️ Не удалось удалить сообщение ${question.messageId} для ${subject}:${ticketNumber}`);
    }
    question.messageId = undefined;
    await writeJson(SUBJECTS_DATA_FILE, subjectsData);
  }
  
  let newMessageId: number;
  
  if (filePath) {
    try {
      await stat(filePath);
    } catch (err) {
      console.error(`❌ Файл не найден: ${filePath}`);
      const sent = await api.sendMessage(
        SUPERGROUP_ID,
        `❌ Файл не найден на сервере.\nПодпись:\n${caption}`,
        {
          reply_markup: keyboard,
          message_thread_id: threadId,
        }
      );
      newMessageId = sent.message_id;
      question.messageId = newMessageId;
      await writeJson(SUBJECTS_DATA_FILE, subjectsData);
      return;
    }

    try {
      const inputFile = new InputFile(filePath);
      const sent = await api.sendDocument(
        SUPERGROUP_ID,
        inputFile,
        {
          caption,
          reply_markup: keyboard,
          message_thread_id: threadId,
        }
      );
      newMessageId = sent.message_id;
    } catch (err) {
      console.error(`❌ Ошибка отправки документа ${filePath}:`, err);
      const sent = await api.sendMessage(
        SUPERGROUP_ID,
        `❌ Ошибка отправки файла.\nПодпись:\n${caption}`,
        {
          reply_markup: keyboard,
          message_thread_id: threadId,
        }
      );
      newMessageId = sent.message_id;
    }
  } else {
    const sent = await api.sendMessage(
      SUPERGROUP_ID,
      caption,
      {
        reply_markup: keyboard,
        message_thread_id: threadId,
      }
    );
    newMessageId = sent.message_id;
  }

  question.messageId = newMessageId;
  await writeJson(SUBJECTS_DATA_FILE, subjectsData);
}