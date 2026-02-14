// src/handlers/messageHandlers/handleAdminSpam.ts
// Registration, Editing, Ticketing, Finished

import { MyContext } from "../../types.js";
import { readJson } from "../../storage/jsonStorage.js";
import { USERS_FILE } from "../../config.js";
import { UserRecord } from "../../types.js";
import { broadcastMessage } from "../../utils/broadcast.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { adminKeyboard_Ticketing, adminKeyboard_CancelSpam } from "../../keyboards/keyboardAdminTicketing.js";
import { adminKeyboard_Editing } from "../../keyboards/keyboardAdminEditing.js";
import { adminKeyboard_Registration } from "../../keyboards/keyboardAdminRegistration.js";
import { fastCheckPhase } from "../../utils/updatePhase.js";
import { writeFile, mkdir, access } from "fs/promises";
import { join } from "path";
import { BOT_TOKEN } from "../../config.js";
import { InlineKeyboard } from "grammy";

const SPAM_FILES_DIR = join(process.cwd(), "data", "spam_files");

const albumCache = new Map<string, { fileIds: string[]; fileNames: string[] }>();

/**
 * Создаёт директорию для хранения файлов рассылки, если она не существует.
 * @returns {Promise<void>}
 */
async function ensureSpamDir() {
  await mkdir(SPAM_FILES_DIR, { recursive: true });
}

/**
 * Сохраняет файл из Telegram локально на диск с обработкой конфликтов имён.
 * @param {any} api - экземпляр Telegram API
 * @param {string} fileId - ID файла в Telegram
 * @param {string} [originalName] - оригинальное имя файла (опционально)
 * @returns {Promise<string>} путь к сохранённому файлу
 */
async function saveFileLocally(api: any, fileId: string, originalName?: string): Promise<string> {
  await ensureSpamDir();
  
  const file = await api.getFile(fileId);
  if (!file.file_path) throw new Error("No file path");
  
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  
  let fileName = originalName || `${fileId}.bin`;
  let filePath = join(SPAM_FILES_DIR, fileName);
  
  let counter = 0;
  while (true) {
    try {
      await access(filePath);
      const extIndex = fileName.lastIndexOf('.');
      const namePart = extIndex > 0 ? fileName.substring(0, extIndex) : fileName;
      const extPart = extIndex > 0 ? fileName.substring(extIndex) : '';
      counter++;
      fileName = `${namePart}_${counter}${extPart}`;
      filePath = join(SPAM_FILES_DIR, fileName);
    } catch {
      await writeFile(filePath, buffer);
      break;
    }
  }
  
  return filePath;
}

/**
 * Обрабатывает сообщения администратора в режиме спам-рассылки.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleAdminSpam(ctx: MyContext): Promise<void> {
  const spamData = ctx.session.admin.spam;
  if (!spamData || !ctx.chat?.id) return;

  if (spamData.userIds?.length) {
    if (ctx.message?.media_group_id) {
      const mediaGroupId = ctx.message.media_group_id;

      if (ctx.message.document) {
        if (!albumCache.has(mediaGroupId)) {
          albumCache.set(mediaGroupId, { fileIds: [], fileNames: [] });
        }
        const cache = albumCache.get(mediaGroupId)!;
        cache.fileIds.push(ctx.message.document.file_id);
        cache.fileNames.push(ctx.message.document.file_name || "file.bin");
      } else if (ctx.message.photo) {
        if (!albumCache.has(mediaGroupId)) {
          albumCache.set(mediaGroupId, { fileIds: [], fileNames: [] });
        }
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const cache = albumCache.get(mediaGroupId)!;
        cache.fileIds.push(photo.file_id);
        cache.fileNames.push("photo.jpg");
      }

      setTimeout(async () => {
        if (!albumCache.has(mediaGroupId)) return;

        const { fileIds, fileNames } = albumCache.get(mediaGroupId)!;
        albumCache.delete(mediaGroupId);

        const filePaths: string[] = [];
        for (let i = 0; i < fileIds.length; i++) {
          try {
            const path = await saveFileLocally(ctx.api, fileIds[i], fileNames[i]);
            filePaths.push(path);
          } catch (err) {
            console.error("Ошибка сохранения файла из альбома:", err);
          }
        }

        ctx.session.admin.spam = { ...spamData, files: [...(spamData.files || []), ...filePaths] };

        await ctx.reply(`✅ Альбом (${filePaths.length} файлов) сохранён. Отправьте текстовое сообщение для рассылки.`);
      }, 2000);

      return;
    }

    if (ctx.message?.document || ctx.message?.photo) {
      try {
        const filePaths = spamData.files || [];

        if (ctx.message.document) {
          const path = await saveFileLocally(
            ctx.api,
            ctx.message.document.file_id,
            ctx.message.document.file_name
          );
          filePaths.push(path);
        } else if (ctx.message.photo) {
          const photo = ctx.message.photo[ctx.message.photo.length - 1];
          const path = await saveFileLocally(ctx.api, photo.file_id);
          filePaths.push(path);
        }

        ctx.session.admin.spam = { ...spamData, files: filePaths };
        await ctx.reply("✅ Файл сохранён. Отправьте текстовое сообщение для рассылки.");
      } catch (err) {
        console.error("Ошибка сохранения файла:", err);
        await ctx.reply("❌ Ошибка сохранения файла.");
      }
      return;
    }

    const text = ctx.message?.text?.trim() || "";
    if (text) {
      let report: string;

      try {
        const result = await broadcastMessage(ctx.api, spamData.userIds, text, spamData.files);
        report = `✅ Рассылка завершена!\nВсего: ${result.total}\nУспешно: ${result.success}`;
      } catch (err) {
        console.error("Ошибка рассылки:", err);
        report = "❌ Ошибка рассылки.";
      }
      const phase = await fastCheckPhase();
      let keyboard: InlineKeyboard | undefined;

      if (phase === "registration") {
        keyboard = adminKeyboard_Registration();
      } else if (phase === "editing") {
        keyboard = adminKeyboard_Editing();
      } else if (phase === "ticketing" || phase === "finished") {
        keyboard = adminKeyboard_Ticketing(phase === "finished");
      } else {
        keyboard = undefined;
      }

      await manageKeyboard(
        ctx,
        report,
        keyboard,
        "admin",
        true
      );
      delete ctx.session.admin.spam;

      return;
    }
    return;
  }

  if (spamData.type === "spam_by_fio" && ctx.message?.text) {
    if (ctx.message?.message_id) {
      await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
    }

    const fioList = ctx.message.text.split(',').map(f => f.trim()).filter(Boolean);
    if (!fioList.length) {
      return;
    }
    
    const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    const userIds = Object.values(users).filter(u => 
      fioList.some(fio => u.fio.toLowerCase().includes(fio.toLowerCase()))
    ).map(u => u.telegramId);
    
    let text: string;
    let keyboard: InlineKeyboard | undefined;

    if (!userIds.length) {
      text = "❌ Пользователи не найдены.";

      const phase = await fastCheckPhase();
      if (phase === "registration") {
        keyboard = adminKeyboard_Registration();
      } else if (phase === "editing") {
        keyboard = adminKeyboard_Editing();
      } else if (phase === "ticketing" || phase === "finished") {
        keyboard = adminKeyboard_Ticketing(phase === "finished");
      } else {
        keyboard = undefined;
      }
    } else {
      ctx.session.admin.spam = { ...spamData, userIds };
      text = `📨 Найдено ${userIds.length} пользователей. Отправьте сообщение для рассылки.` +
                   "До отправки сообщение можно отправлять любое количество файлов.\n" +
                   "Текстовое сообщение завершит операцию.";
      keyboard = adminKeyboard_CancelSpam();
    }

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    )

    return;
  }
}