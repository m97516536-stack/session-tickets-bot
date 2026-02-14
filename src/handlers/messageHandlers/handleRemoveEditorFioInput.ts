// src/handlers/messageHandlers/handleRemoveEditorFioInput.ts
// Registration

import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { adminKeyboard_SelectSubjectForRemoveEditor, adminKeyboard_Registration } from "../../keyboards/keyboardAdminRegistration.js";
import { MyContext, UserRecord } from "../../types.js";
import { deleteMessages } from "../../utils/deleteMessages.js";

/**
 * Обрабатывает ввод ФИ для отстранения редактора.
 * Поддерживает несколько ФИ через запятую.
 * После успешного отстранения возвращает админа в меню выбора предмета.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleRemoveEditorFioInput(ctx: MyContext): Promise<void> {
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
      const wasEditor = user.editor === true;
      const wasEditingSubject = user.editorSubjects?.includes(subject) === true;

      if (user.editorSubjects) {
        user.editorSubjects = user.editorSubjects.filter(s => s !== subject);

        if (user.editorSubjects.length === 0) {
          user.editor = false;
          delete user.editorSubjects;
          delete user.assignedEditorTickets;
        }
      }

      // Отправляем уведомление только если пользователь действительно был редактором этого предмета
      if (wasEditor && wasEditingSubject) {
        try {
          await ctx.api.sendMessage(
            user.telegramId,
            `➖ Вы отстранены от редакторства по предмету «${subject}».\n\nЕсли у вас больше нет других предметов для редактирования, команда /editor будет недоступна.`
          );
        } catch (e) {
          console.warn(`Не удалось уведомить бывшего редактора ${user.fio} (${user.telegramId}):`, e);
        }
      }
    }

    await writeJson(USERS_FILE, users);

    let response = `✅ Успешно отстранены от редакторства по предмету «${subject}»:\n\n`;

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
        response + "\n➖ Выберите предмет для отстранения редактора:",
        adminKeyboard_SelectSubjectForRemoveEditor(allSubjects),
        "admin",
        true
      );
    } else {
      await manageKeyboard(
        ctx,
        "⚠️ Нет доступных предметов для отстранения редактора.",
        adminKeyboard_Registration(),
        "admin",
        true
      );
    }

  } catch (err) {
    console.error("Ошибка при отстранении редактора:", err);
  
    delete ctx.session.admin.awaitingSubject;
    delete ctx.session.admin.state;
    
    await ctx.reply("❌ Ошибка при отстранении редактора. Проверьте логи.");
  }
}