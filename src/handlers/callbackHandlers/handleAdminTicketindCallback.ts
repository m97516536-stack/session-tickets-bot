// src/handlers/callbackHandlers/handleAdminTicketindCallback.ts

import { InlineKeyboard, InputFile } from "grammy";
import { MyContext } from "../../types.js";
import { adminKeyboard_Ticketing, adminKeyboard_SelectSubjectForLoadEditors, adminKeyboard_SelectSubjectForDelete, adminKeyboard_SelectSubjectForLoadUsers, adminKeyboard_SelectSubjectForDownloadTickets, adminKeyboard_LoadModeSelection, adminKeyboard_SelectSubjectForSpam, getUsersListText, adminKeyboard_CancelSpam, adminKeyboard_SpamType, adminKeyboard_StatsType, adminKeyboard_SelectSubjectForStats, getSubjectStatsText, getOverallStatsText } from "../../keyboards/keyboardAdminTicketing.js";
import { adminKeyboard_SubjectSelectionForUpload } from "../../keyboards/keyboardAdminEditing.js";
import { importUserAssignmentsFromSheet, importEditorAssignmentsFromSheet, syncLocalDataToSheet } from "../../storage/googleSheets.js";
import { fastCheckPhase } from "../../utils/updatePhase.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson } from "../../storage/jsonStorage.js";
import { AllSubjectsData, UserRecord } from "../../types.js";
import { SUBJECTS_DATA_FILE, USERS_FILE } from "../../config.js";
import { getLatestTicketFilePath } from "../../utils/fileManager.js";
import { deleteSubject } from "../../utils/deleteSubject.js";

/**
 * Обрабатывает действия админа на этапе подготовки билетов и после.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleAdminTicketingCallback(ctx: MyContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  // --- Получение биелтов --- //

  if (data === "admin_download_tickets") {
    await ctx.answerCallbackQuery();

    let allSubjects: string[] = [];
    try {
      const subjectData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      allSubjects = Object.keys(subjectData).filter(key => 
        Array.isArray(subjectData[key]) && subjectData[key].length > 0
      );
    } catch (err) {
      console.log("Ошибка загрузки предметов:", err);
      await ctx.answerCallbackQuery("❌ Ошибка загрузки предметов.");
      return;
    }

    let text: string;
    let keyboard: InlineKeyboard;

    if (allSubjects.length === 0) {
      const phase = await fastCheckPhase();

      text = "📝 Админ-панель\n\n❌ Нет доступных предметов для скачивания";
      keyboard = adminKeyboard_Ticketing(phase === "finished");
    } else {
      text = "Выберите предмет для получения билетов:";
      keyboard = adminKeyboard_SelectSubjectForDownloadTickets(allSubjects);
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

  if (data?.startsWith("download_tickets_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("download_tickets_", "");

    try {
      const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      const tickets = subjectsData[subject] || [];

      if (!Array.isArray(tickets) || tickets.length === 0) {
        const phase = await fastCheckPhase();
        await manageKeyboard(
          ctx,
          `❌ Нет билетов по предмету "${subject}".`,
          adminKeyboard_Ticketing(phase === "finished"),
          "admin",
          false
        );
        return;
      }

      const approvedTickets = tickets.filter(
        (ticket: any) => ticket.status === "approved"
      );

      if (approvedTickets.length === 0) {
        const phase = await fastCheckPhase();
        await manageKeyboard(
          ctx,
          `❌ Нет одобренных билетов по предмету "${subject}".`,
          adminKeyboard_Ticketing(phase === "finished"),
          "admin",
          false
        );
        return;
      }

      const filePaths: string[] = [];
      for (const ticket of approvedTickets) {
        const filePath = await getLatestTicketFilePath(subject, ticket.number);
        if (filePath) {
          filePaths.push(filePath);
        }
      }

      if (filePaths.length === 0) {
        const phase = await fastCheckPhase();
        await manageKeyboard(
          ctx,
          `❌ У одобренных билетов нет прикреплённых файлов.`,
          adminKeyboard_Ticketing(phase === "finished"),
          "admin",
          false
        );
        return;
      }

      if (filePaths.length === 1) {
        await ctx.replyWithDocument(new InputFile(filePaths[0]));
      } else {
        const media = filePaths.map(path => ({
          type: "document" as const,
          media: new InputFile(path)
        }));
        await ctx.replyWithMediaGroup(media);
      }

      const phase = await fastCheckPhase();
      await manageKeyboard(
        ctx,
        `✅ Отправлено ${filePaths.length} файлов по предмету "${subject}"`,
        adminKeyboard_Ticketing(phase === "finished"),
        "admin",
        true
      );
    } catch (err) {
      console.error("Ошибка при отправке билетов:", err);
      await ctx.reply("❌ Ошибка при отправке билетов.");

      const phase = await fastCheckPhase();
      await manageKeyboard(
        ctx,
        "📝 Админ-панель",
        adminKeyboard_Ticketing(phase === "finished"),
        "admin",
        false
      );
    }
    return;
  }

  // --- Спам сообщения --- //

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

      const phase = await fastCheckPhase();

      text = "❌ Ошибка загрузки пользователей";
      keyboard = adminKeyboard_Ticketing(phase === "finished");
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
      const phase = await fastCheckPhase();

      text = "📝 Админ-панель\n\n❌ Нет доступных предметов для рассылки";
      keyboard = adminKeyboard_Ticketing(phase === "finished");
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

      const phase = await fastCheckPhase();
      await manageKeyboard(
        ctx,
        "❌ Ошибка при загрузке списка пользователей.",
        adminKeyboard_Ticketing(phase === "finished"),
        "admin",
        false
      );
    }
    return;
  }

  // --- Статистика --- //

  if (data === "admin_stats") {
    await ctx.answerCallbackQuery();

    const text = "📊 Выберите тип статистики:";
    const keyboard = adminKeyboard_StatsType();

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }

  if (data === "stats_by_subject") {
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
      const phase = await fastCheckPhase();

      text = "📝 Админ-панель\n\n❌ Нет доступных предметов для просмотра статистики";
      keyboard = adminKeyboard_Ticketing(phase === "finished");
    } else {
      text = "Выберите предмет для просмотра статистики:";
      keyboard = adminKeyboard_SelectSubjectForStats(allSubjects);
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

  if (data.startsWith("stats_subject_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("stats_subject_", "");

    let text: string;

    try {
      text = await getSubjectStatsText(subject);
    } catch (err) {
      console.error("Ошибка получения статистики:", err);
      text = "❌ Ошибка при получении статистики. Проверьте логи.";
    }

    const phase = await fastCheckPhase();
    const keyboard = adminKeyboard_Ticketing(phase === "finished");

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }

  if (data === "stats_overall") {
    await ctx.answerCallbackQuery();

    let text: string;
  
    try {
      text = await getOverallStatsText();
    } catch (err) {
      console.error("Ошибка получения общей статистики:", err);
      text = "❌ Ошибка при получении общей статистики. Проверьте логи.";
    }

    const phase = await fastCheckPhase();
    const keyboard = adminKeyboard_Ticketing(phase === "finished");

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }

  // --- Загрузка из таблтцы --- //

  if (data === "admin_load_from_sheet") {
    await ctx.answerCallbackQuery();

    const text = "🔄 Выберите режим загрузки из Google Таблицы:";
    const keyboard = adminKeyboard_LoadModeSelection();

    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }

  if (data === "load_users_mode") {
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
      const phase = await fastCheckPhase();

      text = "📝 Админ-панель\n\n❌ Нет доступных предметов для загрузки из таблицы";
      keyboard = adminKeyboard_Ticketing(phase === "finished");
    } else {
      text = "Выберите предмет для загрузки пользователей из таблицы:";
      keyboard = adminKeyboard_SelectSubjectForLoadUsers(allSubjects);
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

  if (data.startsWith("load_users_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("load_users_", "");

    try {
      await importUserAssignmentsFromSheet(subject);

      const text = `✅ Студенты для предмета "${subject}" успешно обновлены из таблицы.`;
      const phase = await fastCheckPhase();
      const keyboard = adminKeyboard_Ticketing(phase === "finished");

      await manageKeyboard(
        ctx,
        text,
        keyboard,
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка обновления студентов:", err);

      const text = `❌ Ошибка обновления студентов для "${subject}"`;
      const phase = await fastCheckPhase();
      const keyboard = adminKeyboard_Ticketing(phase === "finished");

      await manageKeyboard(
        ctx,
        text,
        keyboard,
        "admin",
        false
      );
    }
    return;
  }

  if (data === "load_editors_mode") {
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
      const phase = await fastCheckPhase();

      text = "📝 Админ-панель\n\n❌ Нет доступных предметов для загрузки из таблицы";
      keyboard = adminKeyboard_Ticketing(phase === "finished");
    } else {
      text = "Выберите предмет для загрузки редакторов из таблицы:";
      keyboard = adminKeyboard_SelectSubjectForLoadEditors(allSubjects);
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

  if (data.startsWith("load_editors_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("load_editors_", "");

    try {
      await importEditorAssignmentsFromSheet(subject);

      const text = `✅ Редакторы для предмета "${subject}" успешно обновлены из таблицы.`;
      const phase = await fastCheckPhase();
      const keyboard = adminKeyboard_Ticketing(phase === "finished");

      await manageKeyboard(
        ctx,
        text,
        keyboard,
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка обновления редакторов:", err);

      const text = `❌ Ошибка обновления редакторов для "${subject}"`;
      const phase = await fastCheckPhase();
      const keyboard = adminKeyboard_Ticketing(phase === "finished");

      await manageKeyboard(
        ctx,
        text,
        keyboard,
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
    const phase = await fastCheckPhase();

    try {
      const result = await deleteSubject(subject);

      await manageKeyboard(
        ctx,
        result,
        adminKeyboard_Ticketing(phase === "finished"),
        "admin",
        false
      );
    } catch (err) {
      console.error(`Ошибка записи данных для "${subject}":`, err);

      await manageKeyboard(
        ctx,
        "❌ Ошибка при очистке БД",
        adminKeyboard_Ticketing(phase === "finished"),
        "admin",
        false
      );
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
    const phase = await fastCheckPhase();

    try {
      await syncLocalDataToSheet(subject);

      await manageKeyboard(
        ctx,
        `✅ Данные для "${subject}" успешно записаны в таблицу!\nСтуденты (колонка C) и редакторы (колонка D) синхронизированы.`,
        adminKeyboard_Ticketing(phase === "finished"),
        "admin",
        false
      );
    } catch (err) {
      console.error(`Ошибка записи данных для "${subject}":`, err);

      await manageKeyboard(
        ctx,
        "❌ Ошибка при обновлении таблицы",
        adminKeyboard_Ticketing(phase === "finished"),
        "admin",
        false
      );
    }
    return;
  }

  // --- Отмена --- //

  if (data === "admin_cancel") {
    await ctx.answerCallbackQuery();

    delete ctx.session.admin.awaitingSubject;
    delete ctx.session.admin.awaitingSubjectThreadId;
    delete ctx.session.admin.deadlines;
    delete ctx.session.admin.downloadMode;
    delete ctx.session.admin.state;
    delete ctx.session.admin.spam;

    const phase = await fastCheckPhase();

    const text = "📝 Админ-панель\n\nОперация была отменена";
    const keyboard = adminKeyboard_Ticketing(phase === "finished");


    await manageKeyboard(
      ctx,
      text,
      keyboard,
      "admin",
      false
    );
    return;
  }
}