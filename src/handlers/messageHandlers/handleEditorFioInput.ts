// src/handlers/messageHandlers/handleEditorFioInput.ts
// Registration

import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { adminKeyboard_SelectSubjectForEditor, adminKeyboard_Registration } from "../../keyboards/keyboardAdminRegistration.js";
import { MyContext, UserRecord } from "../../types.js";
import { deleteMessages } from "../../utils/deleteMessages.js";

/**
 * Обрабатывает ввод ФИ для назначения редактора.
 * Поддерживает несколько ФИ через запятую.
 * После успешного назначения возвращает админа в меню выбора предмета.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleEditorFioInput(ctx: MyContext): Promise<void> {
  const text = ctx.message?.text?.trim();
  const chatId = ctx.chat?.id;
  const subject = ctx.session.admin.awaitingSubject;

  await deleteMessages(ctx.api, chatId, ctx.message?.message_id);

  if (!text || !subject) {
    await ctx.reply("❌ Ошибка: не удалось определить предмет или ФИ.");

    delete ctx.session.admin.awaitingSubject;
    delete ctx.session.admin.state;
    return;
  }

  const fioList = text
    .split(',')
    .map(fio => fio.trim())
    .filter(fio => fio.length > 0);

  if (fioList.length === 0) {
    await ctx.reply("❌ Введите хотя бы одно ФИ.");
    return;
  }

  try {
    let users = await readJson<Record<string, UserRecord>>(USERS_FILE);

    const foundUsers: UserRecord[] = [];
    const notFoundFios: string[] = [];

    for (const fio of fioList) {
      const user = Object.values(users).find(u => 
        u.fio.toLowerCase().includes(fio.toLowerCase())
      );

      if (user) {
        foundUsers.push(user);
      } else {
        notFoundFios.push(fio);
      }
    }

    for (const user of foundUsers) {
      if (!user.editorSubjects) user.editorSubjects = [];
      if (!user.editorSubjects.includes(subject)) {
        user.editorSubjects.push(subject);
      }

      user.editor = true;

      try {
        await ctx.api.sendMessage(
          user.telegramId,
          `👑 Вы назначены редактором по предмету «${subject}»!\n\nИспользуйте команду /editor для работы с билетами.`
        );
      } catch (e) {
        console.warn(`Не удалось уведомить редактора ${user.fio} (${user.telegramId}):`, e);
      }
    }

    await writeJson(USERS_FILE, users);

    let response = `✅ Успешно назначены редакторами по предмету «${subject}»:\n\n`;
    
    if (foundUsers.length > 0) {
      foundUsers.forEach((user, index) => {
        response += `${index + 1}. ${user.fio} (ID: ${user.telegramId})\n`;
      });
    } else {
      response += "⚠️ Никто не найден по указанным ФИ.\n";
    }

    if (notFoundFios.length > 0) {
      response += `\n❌ Не найдены пользователи с ФИ:\n`;
      notFoundFios.forEach((fio, index) => {
        response += `${index + 1}. ${fio}\n`;
      });
    }

    let allSubjects: string[] = [];
    try {
      const subjectsData = await readJson<Record<string, unknown>>(SUBJECTS_DATA_FILE);
      allSubjects = Object.keys(subjectsData).filter(key => 
        Array.isArray(subjectsData[key]) && (subjectsData[key] as unknown[]).length > 0
      );
    } catch (err) {
      console.error("Ошибка загрузки предметов:", err);
    }

    delete ctx.session.admin.awaitingSubject;
    delete ctx.session.admin.state;

    if (allSubjects.length > 0) {
      await manageKeyboard(
        ctx,
        response + "\n👑 Выберите предмет для назначения редактора:",
        adminKeyboard_SelectSubjectForEditor(allSubjects),
        "admin",
        true
      );
    } else {
      await manageKeyboard(
        ctx,
        "⚠️ Нет доступных предметов для назначения редактора.",
        adminKeyboard_Registration(),
        "admin",
        true
      );
    }

  } catch (err) {
    console.error("Ошибка при назначении редактора:", err);

    delete ctx.session.admin.awaitingSubject;
    delete ctx.session.admin.state;
    
    await ctx.reply("❌ Ошибка при назначении редактора. Проверьте логи.");
  }
}