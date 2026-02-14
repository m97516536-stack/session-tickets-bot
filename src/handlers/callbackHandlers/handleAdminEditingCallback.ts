// src/handlers/callbackHandlers/handleAdminRegistrationCallback.ts

import { InlineKeyboard } from "grammy";
import { MyContext, UserRecord } from "../../types.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { deleteSubject } from "../../utils/deleteSubject.js";
import { adminKeyboard_Editing, adminKeyboard_SubjectSelectionForUsers, adminKeyboard_DownloadModeSelection, adminKeyboard_SubjectSelectionForDownload, adminKeyboard_SubjectSelectionForUpload } from "../../keyboards/keyboardAdminEditing.js";
import { adminKeyboard_SpamType, adminKeyboard_CancelSpam, adminKeyboard_SelectSubjectForDelete, getUsersListText, adminKeyboard_SelectSubjectForSpam } from "../../keyboards/keyboardAdminTicketing.js";
import { AllSubjectsData } from "../../types.js";
import { fetchTicketsFromSheet, importUserAssignmentsFromSheet, importEditorAssignmentsFromSheet, syncLocalDataToSheet } from "../../storage/googleSheets.js";
import { distributeTicketsForSubject } from "../../utils/distributeTickets.js";
import { distributeEditorTicketsForSubject } from "../../utils/distributeEditorTickets.js";

/**
 * Обрабатывает действия администратора на этапе редактирования.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleAdminEditingCallback(ctx: MyContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  if (data === "view_all_users") {
    await ctx.answerCallbackQuery();

    try {
      const users = await readJson<Record<string, UserRecord>>(USERS_FILE);

      const userList = Object.values(users)
        .map(u => `• ${u.fio}`)
        .join("\n");

      const message = userList ? userList : "❌ Нет зарегистрированных пользователей.";

      await manageKeyboard(
        ctx,
        `📋 Все зарегистрированные пользователи:\n\n${message}`,
        adminKeyboard_Editing(),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка загрузки данных.",
        adminKeyboard_Editing(),
        "admin",
        false
      );
    }
    return;
  }

  if (data === "view_users_by_subject") {
    await ctx.answerCallbackQuery();

    try {
      const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      const subjects = Object.keys(subjectsData);

      if (subjects.length === 0) {
        await manageKeyboard(
          ctx,
          "❌ Нет доступных предметов.",
          adminKeyboard_Editing(),
          "admin",
          false
        );
        return;
      }

      const keyboard = adminKeyboard_SubjectSelectionForUsers(subjects);

      await manageKeyboard(
        ctx,
        "📚 Выберите предмет:",
        keyboard,
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка загрузки данных.",
        adminKeyboard_Editing(),
        "admin",
        false
      );
    }
    return;
  }

  if (data === "view_editors") {
    await ctx.answerCallbackQuery();

    try {
      let users = await readJson<Record<string, UserRecord>>(USERS_FILE);

      const editors = Object.values(users).filter(user => 
        user.editor && user.editorSubjects && user.editorSubjects.length > 0
      );

      const editorsBySubject: Record<string, UserRecord[]> = {};

      for (const editor of editors) {
        if (!editor.editorSubjects) continue;

        for (const subject of editor.editorSubjects) {
          if (!editorsBySubject[subject]) {
            editorsBySubject[subject] = [];
          }
          editorsBySubject[subject].push(editor);
        }
      }

      let text = "👑 Список редакторов:\n\n";

      if (Object.keys(editorsBySubject).length === 0) {
        text += "Нет назначенных редакторов.";
      } else {
        for (const [subject, subjectEditors] of Object.entries(editorsBySubject)) {
          text += `📚 ${subject} (${subjectEditors.length}):\n`;
          subjectEditors.forEach((editor, index) => {
            text += `  ${index + 1}. ${editor.fio}\n`;
          });
          text += "\n";
        }
      }

      await manageKeyboard(
        ctx,
        text,
        adminKeyboard_Editing(),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки списка редакторов:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка загрузки списка редакторов.",
        adminKeyboard_Editing(),
        "admin",
        false
      );
    }
    return;
  }

  if (data === "view_stats") {
    await ctx.answerCallbackQuery();

    try {
      const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
      const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      const subjects = Object.keys(subjectsData);

      const totalUsers = Object.keys(users).length;

      let stats = `📊 Статистика:\n\n`;
      stats += `Всего пользователей: ${totalUsers}\n\n`;

      for (const subject of subjects) {
        const usersOnSubject = Object.values(users).filter(u => u.subjects?.includes(subject));
        stats += `🔹 ${subject}: ${usersOnSubject.length} человек\n`;
      }

      await manageKeyboard(
        ctx,
        stats,
        adminKeyboard_Editing(),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка загрузки данных.",
        adminKeyboard_Editing(),
        "admin",
        false
      );
    }
    return;
  }

  if (data?.startsWith("view_users_for_")) {
    await ctx.answerCallbackQuery();

    try {
      const subject = data.replace("view_users_for_", "");
      const users = await readJson<Record<string, UserRecord>>(USERS_FILE);

      const usersOnSubject = Object.values(users).filter(u => u.subjects?.includes(subject));

      if (usersOnSubject.length === 0) {
        await manageKeyboard(
          ctx,
          `❌ Никто не записался на предмет "${subject}".`,
          adminKeyboard_Editing(),
          "admin",
          false
        );
        return;
      }

      const userList = usersOnSubject
        .map(u => `• ${u.fio}`)
        .join("\n");

      await manageKeyboard(
        ctx,
        `📚 Пользователи, записавшиеся на "${subject}":\n\n${userList}`,
        adminKeyboard_Editing(),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка загрузки данных.",
        adminKeyboard_Editing(),
        "admin",
        false
      );
    }
    return;
  }

  if (data === "admin_spam") {
    await ctx.answerCallbackQuery();

    const text = "📢 Выберите тип рассылки:";
    const keyboard = adminKeyboard_SpamType();

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }

  if (data === "spam_all") {
    await ctx.answerCallbackQuery();

    let text: string;
    let keyboard: InlineKeyboard;

    try {
      const usersData = await readJson<Record<string, UserRecord>>(USERS_FILE);
      const userIds = Object.values(usersData).map(user => user.telegramId);

      ctx.session.admin.spam = { 
        type: "spam_all",
        userIds: userIds
      };

      text = "📨 Отправьте сообщение для рассылки всем пользователям.\n\n" +
               "До отправки сообщение можно отправлять любое количество файлов.\n" +
               "Текстовое сообщение завершит операцию.";
      keyboard = adminKeyboard_CancelSpam();
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
      ctx.session.admin.spam = { 
        type: "spam_all",
        userIds: []
      };

      text = "❌ Ошибка загрузки пользователей";
      keyboard = adminKeyboard_Editing();
    }


    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }

  if (data === "spam_by_fio") {
    await ctx.answerCallbackQuery();

    let text: string;

    try {
      text = await getUsersListText();
    } catch (err) {
      console.error("Ошибка получения списка пользователей:", err);
      text = "❌ Ошибка при загрузке списка пользователей.";
    }
    const keyboard = adminKeyboard_CancelSpam();

    ctx.session.admin.spam = { type: "spam_by_fio" };

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }

  if (data === "spam_by_subject") {
    await ctx.answerCallbackQuery();

    let allSubjects: string[] = [];
    try {
      const subjectData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      allSubjects = Object.keys(subjectData);
    } catch (err) {
      console.log("Ошибка загрузки предметов:", err);
      await ctx.answerCallbackQuery("❌ Ошибка загрузки предметов.");
      return;
    }

    let text: string;
    let keyboard: InlineKeyboard;

    if (allSubjects.length === 0) {
      text = "📝 Админ-панель\n\n❌ Нет доступных предметов для рассылки";
      keyboard = adminKeyboard_Editing();
    } else {
      text = "Выберите предмет для рассылки:";
      keyboard = adminKeyboard_SelectSubjectForSpam(allSubjects);
    }

    ctx.session.admin.spam = { type: "spam_by_subject" };

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }

  if (data.startsWith("spam_subject_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("spam_subject_", "");

    try {
      const usersData = await readJson<Record<string, UserRecord>>(USERS_FILE);
      const userIds = Object.values(usersData)
        .filter(user => user.subjects?.includes(subject))
        .map(user => user.telegramId);

      if (ctx.session.admin.spam?.type === "spam_by_subject") {
        ctx.session.admin.spam = {
          ...ctx.session.admin.spam,
          subject: subject,
          userIds: userIds
        };
      } else {
        ctx.session.admin.spam = {
          type: "spam_by_subject",
          subject: subject,
          userIds: userIds
        };
      }

      const text = `📨 Отправьте сообщение для рассылки по предмету "${subject}".\n\n` +
                   "Можно прикрепить файл(ы) к сообщению.\n" +
                   "Для отмены нажмите кнопку \"Отмена\".";
      const keyboard = adminKeyboard_CancelSpam();

      await manageKeyboard(
        ctx,
        text,
        keyboard,
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);

      await manageKeyboard(
        ctx,
        "❌ Ошибка при загрузке списка пользователей.",
        adminKeyboard_Editing(),
        "admin",
        false
      );
    }
    return;
  }

  if (data === "download_from_sheet") {
    await ctx.answerCallbackQuery();

    await manageKeyboard(
      ctx,
      "Выберите режим загрузки:",
      adminKeyboard_DownloadModeSelection(),
      "admin",
      false
    );
    return;
  }

  if (data === "mode_with_redistribution" || data === "mode_without_redistribution") {
    await ctx.answerCallbackQuery();
    ctx.session.admin.downloadMode = data === "mode_with_redistribution" 
      ? "with_redistribution" 
      : "without_redistribution";

    try {
      const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      const subjects = Object.keys(subjectsData);

      if (subjects.length === 0) {
        await ctx.reply("❌ Нет доступных предметов для обновления.");
        return;
      }

      await manageKeyboard(
        ctx,
        "📚 Выберите предмет для обновления:",
        adminKeyboard_SubjectSelectionForDownload(subjects),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки предметов:", err);
      await ctx.reply("❌ Ошибка при загрузке списка предметов.");
    }
    return;
  }

  if (data?.startsWith("download_subject_")) {
    await ctx.answerCallbackQuery();
    const subject = data.replace("download_subject_", "");
    const mode = ctx.session.admin.downloadMode;

    try {
      const tickets = await fetchTicketsFromSheet(subject);
      let subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);

      if (!subjectsData[subject]) {
        throw new Error(`Предмет "${subject}" не найден в конфигурации.`);
      }

      subjectsData[subject] = tickets;
      await writeJson(SUBJECTS_DATA_FILE, subjectsData);

      let text: string;

      if (mode === "with_redistribution") {
        await importUserAssignmentsFromSheet(subject);
        await importEditorAssignmentsFromSheet(subject);
        await distributeTicketsForSubject(subject);

        try {
          await distributeEditorTicketsForSubject(subject);
        } catch (editorErr) {
          if (!(editorErr instanceof Error && editorErr.message.includes("Нет редакторов"))) {
            throw editorErr;
          }
        }

        text = `✅ Билеты для "${subject}" перераспределены и сохранены в таблицу!`;
      } 
      else if (mode === "without_redistribution") {
        await importUserAssignmentsFromSheet(subject);
        await importEditorAssignmentsFromSheet(subject);

        text = `✅ Распределение для "${subject}" успешно импортировано из таблицы!`;
      } 
      else {
        throw new Error(`Неизвестный режим загрузки: ${mode}`);
      }

      await manageKeyboard(
        ctx,
        text,
        adminKeyboard_Editing(),
        "admin",
        false
      );
    } catch (err) {
      console.error(`Ошибка обновления предмета ${subject}:`, err);
      await ctx.reply(`❌ Ошибка: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);

      await manageKeyboard(
        ctx,
        "📋 Админ-панель (этап редактирования)",
        adminKeyboard_Editing(),
        "admin",
        false
      );
    } finally {
      delete ctx.session.admin.downloadMode;
    }
    return;
  }

  if (data === "upload_to_sheet") {
    await ctx.answerCallbackQuery();

    try {
      const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      const subjects = Object.keys(subjectsData);

      if (subjects.length === 0) {
        await ctx.reply("❌ Нет доступных предметов для записи.");
        return;
      }

      await manageKeyboard(
        ctx,
        "📤 Выберите предмет для записи данных из файлов в таблицу:",
        adminKeyboard_SubjectSelectionForUpload(subjects),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки предметов:", err);
      await ctx.reply("❌ Ошибка при загрузке списка предметов.");
    }
    return;
  }

  if (data?.startsWith("upload_subject_")) {
    await ctx.answerCallbackQuery();
    const subject = data.replace("upload_subject_", "");

    try {
      await syncLocalDataToSheet(subject);

      await manageKeyboard(
        ctx,
        `✅ Данные для "${subject}" успешно записаны в таблицу!\nСтуденты (колонка C) и редакторы (колонка D) синхронизированы.`,
        adminKeyboard_Editing(),
        "admin",
        false
      );
    } catch (err) {
      console.error(`Ошибка записи данных для "${subject}":`, err);

      await manageKeyboard(
        ctx,
        "❌ Ошибка при обновлении таблицы",
        adminKeyboard_Editing(),
        "admin",
        false
      );
    }
  return;
  }

  if (data === "load_new_subject") {
    await ctx.answerCallbackQuery();

    ctx.session.admin.state = "awaiting_new_subject_name";

    const text = "Введите название нового предмета (оно должно совпадать с название таблицы)";
    const keyboard = adminKeyboard_CancelSpam();

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }

  if (data === "delete_subject") {
    await ctx.answerCallbackQuery();

    try {
      const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      const subjects = Object.keys(subjectsData);

      if (subjects.length === 0) {
        await ctx.reply("❌ Нет доступных предметов для записи.");
        return;
      }

      await manageKeyboard(
        ctx,
        "📤 Выберите предмет для его удаления:",
        adminKeyboard_SelectSubjectForDelete(subjects),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки предметов:", err);
      await ctx.reply("❌ Ошибка при загрузке списка предметов.");
    }
    return;
  }

  if (data.startsWith("delete_subject_")) {
    await ctx.answerCallbackQuery();
    const subject = data.replace("delete_subject_", "");

    try {
      const result = await deleteSubject(subject);

      await manageKeyboard(
        ctx,
        result,
        adminKeyboard_Editing(),
        "admin",
        false
      );
    } catch (err) {
      console.error(`Ошибка записи данных для "${subject}":`, err);

      await manageKeyboard(
        ctx,
        "❌ Ошибка при очистке БД",
        adminKeyboard_Editing(),
        "admin",
        false
      );
    }
    return;
  }

  if (data === "admin_cancel") {
    await ctx.answerCallbackQuery();

    delete ctx.session.admin.awaitingSubject;
    delete ctx.session.admin.awaitingSubjectThreadId;
    delete ctx.session.admin.deadlines;
    delete ctx.session.admin.downloadMode;
    delete ctx.session.admin.state;
    delete ctx.session.admin.spam;

    await manageKeyboard(
      ctx,
      "📋 Админ-панель (этап регистрации)",
      adminKeyboard_Editing(),
      "admin",
      false
    );
    return;
  }
}