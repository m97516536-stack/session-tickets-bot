import { Api, InlineKeyboard, InputFile } from "grammy";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { EDITOR_MESSAGES_FILE } from "../config.js";
import { getLatestTicketFilePath } from "./fileManager.js";

// 2 часа в миллисекундах
const EXPIRY_MS = 2 * 60 * 60 * 1000;

/**
 * Структура хранилища сообщений редакторов.
 * Ключ: `${editorId}_${subject}_${ticketNumber}`
 */
interface EditorMessages {
  [key: string]: {
    chatId: number;
    messageId: number;
    expiresAt: number; // timestamp в мс
  };
}

/**
 * Отправляет или обновляет сообщение с билетом для редактора.
 * Если файл существует — отправляет документ, иначе текст.
 * Автоматически удаляет старое сообщение и устанавливает таймер на 2 часа.
 * @param api - экземпляр Telegram API
 * @param editorId - ID редактора
 * @param chatId - ID чата (приватный)
 * @param subject - название предмета
 * @param ticketNumber - номер билета
 * @param caption - текст сообщения
 * @param keyboard - клавиатура действий
 */
export async function sendEditorTicketMessage(
  api: Api,
  editorId: number,
  chatId: number,
  subject: string,
  ticketNumber: number,
  caption: string,
  keyboard: InlineKeyboard
): Promise<void> {
  const messages = await readJson<EditorMessages>(EDITOR_MESSAGES_FILE);
  const ticketKey = `${editorId}_${subject}_${ticketNumber}`;

  // Удаляем старое сообщение, если оно существует
  const oldMessage = messages[ticketKey];
  if (oldMessage) {
    try {
      await api.deleteMessage(oldMessage.chatId, oldMessage.messageId);
    } catch (e) {
      // Игнорируем ошибки удаления
    }
  }

  // Получаем путь к файлу (если есть)
  const filePath = await getLatestTicketFilePath(subject, ticketNumber);

  let sent;
  if (filePath) {
    // Отправляем ДОКУМЕНТ с файлом
    sent = await api.sendDocument(
      chatId,
      new InputFile(filePath),
      {
        caption,
        reply_markup: keyboard,
        parse_mode: "HTML",
      }
    );
  } else {
    // Отправляем текстовое сообщение (если файла нет)
    sent = await api.sendMessage(
      chatId,
      caption,
      {
        reply_markup: keyboard,
        parse_mode: "HTML",
      }
    );
  }

  // Сохраняем новое сообщение с таймером 2 часа
  messages[ticketKey] = {
    chatId,
    messageId: sent.message_id,
    expiresAt: Date.now() + EXPIRY_MS,
  };

  await writeJson(EDITOR_MESSAGES_FILE, messages);
}

/**
 * Сбрасывает таймер для сообщения с билетом (при любом действии редактора).
 * @param editorId - ID редактора
 * @param subject - название предмета
 * @param ticketNumber - номер билета
 */
export async function resetEditorTicketTimer(
  editorId: number,
  subject: string,
  ticketNumber: number
): Promise<void> {
  const messages = await readJson<EditorMessages>(EDITOR_MESSAGES_FILE);
  const ticketKey = `${editorId}_${subject}_${ticketNumber}`;

  if (messages[ticketKey]) {
    messages[ticketKey].expiresAt = Date.now() + EXPIRY_MS;
    await writeJson(EDITOR_MESSAGES_FILE, messages);
  }
}

/**
 * Удаляет сообщение с билетом (например, после принятия или отправки на доработку).
 * @param api - экземпляр Telegram API
 * @param editorId - ID редактора
 * @param subject - название предмета
 * @param ticketNumber - номер билета
 */
export async function deleteEditorTicketMessage(
  api: Api,
  editorId: number,
  subject: string,
  ticketNumber: number
): Promise<void> {
  const messages = await readJson<EditorMessages>(EDITOR_MESSAGES_FILE);
  const ticketKey = `${editorId}_${subject}_${ticketNumber}`;
  const msg = messages[ticketKey];
  
  if (msg) {
    try {
      await api.deleteMessage(msg.chatId, msg.messageId);
    } catch (e) {
      // Игнорируем ошибки удаления
    }
    delete messages[ticketKey];
    await writeJson(EDITOR_MESSAGES_FILE, messages);
  }
}

/**
 * Удаляет все просроченные сообщения редакторов.
 * @param api - экземпляр Telegram API
 */
export async function cleanupExpiredEditorMessages(api: Api): Promise<void> {
  const messages = await readJson<EditorMessages>(EDITOR_MESSAGES_FILE);
  const now = Date.now();
  const toDelete: string[] = [];

  for (const [key, msg] of Object.entries(messages)) {
    if (msg.expiresAt < now) {
      toDelete.push(key);
      try {
        await api.deleteMessage(msg.chatId, msg.messageId);
      } catch (e) {
        // Игнорируем ошибки
      }
    }
  }

  for (const key of toDelete) {
    delete messages[key];
  }

  if (toDelete.length > 0) {
    await writeJson(EDITOR_MESSAGES_FILE, messages);
    console.log(`🧹 Очищено ${toDelete.length} просроченных сообщений редакторов`);
  }
}