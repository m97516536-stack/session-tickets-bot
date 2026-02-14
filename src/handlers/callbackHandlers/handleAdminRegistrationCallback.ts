// src/handlers/callbackHandlers/handleAdminRegistrationCallback.ts

import { InlineKeyboard } from "grammy";
import { MyContext, UserRecord, EditorRequest } from "../../types.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson } from "../../storage/jsonStorage.js";
import { deleteSubject } from "../../utils/deleteSubject.js";
import { USERS_FILE, SUBJECTS_DATA_FILE, EDITOR_REQUESTS_FILE } from "../../config.js";
import { adminKeyboard_Registration, adminKeyboard_SelectSubjectForUsers, adminKeyboard_SelectEditorSource, adminKeyboard_SelectSubjectForEditor, adminKeyboard_SelectRemoveEditorSource, adminKeyboard_SelectSubjectForRemoveEditor } from "../../keyboards/keyboardAdminRegistration.js";
import { adminKeyboard_SpamType, adminKeyboard_CancelSpam, getUsersListText, adminKeyboard_SelectSubjectForSpam, adminKeyboard_SelectSubjectForDelete } from "../../keyboards/keyboardAdminTicketing.js";
import { AllSubjectsData } from "../../types.js";

/**
 * Обрабатывает действия администратора на этапе регистрации (просмотр пользователей, статистики, назначение редакторов).
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleAdminRegistrationCallback(ctx: MyContext) {
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
        adminKeyboard_Registration(),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка загрузки данных.",
        adminKeyboard_Registration(),
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
          adminKeyboard_Registration(),
          "admin",
          false
        );
        return;
      }

      const keyboard = adminKeyboard_SelectSubjectForUsers(subjects);

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
        adminKeyboard_Registration(),
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
      keyboard = adminKeyboard_Registration();
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
      keyboard = adminKeyboard_Registration();
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
        adminKeyboard_Registration(),
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
        adminKeyboard_Registration(),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка загрузки данных.",
        adminKeyboard_Registration(),
        "admin",
        false
      );
    }
    return;
  }

  if (data === "load_new_subject") {
    await ctx.answerCallbackQuery();

    ctx.session.admin.state = "awaiting_subject_name";

    await manageKeyboard(
      ctx,
      "Введите названия предметов для загрузки из таблицы через запятую:",
      adminKeyboard_CancelSpam(),
      "admin",
      false
    );
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
        adminKeyboard_Registration(),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки списка редакторов:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка загрузки списка редакторов.",
        adminKeyboard_Registration(),
        "admin",
        false
      );
    }
    return;
  }

  if (data === "assign_editor") {
    await ctx.answerCallbackQuery();

    let allSubjects: string[] = [];
    try {
      const subjectsData = await readJson<Record<string, unknown>>(SUBJECTS_DATA_FILE);
      allSubjects = Object.keys(subjectsData).filter(key => 
        Array.isArray(subjectsData[key]) && (subjectsData[key] as unknown[]).length > 0
      );
    } catch (err) {
      console.error("Ошибка загрузки предметов:", err);
    }

    if (allSubjects.length === 0) {
      await manageKeyboard(
        ctx,
        "❌ Нет доступных предметов для назначения редактора.",
        adminKeyboard_Registration(),
        "admin",
        false
      );
      return;
    }

    await manageKeyboard(
      ctx,
      "👑 Выберите предмет для назначения редактора:",
      adminKeyboard_SelectSubjectForEditor(allSubjects),
      "admin",
      false
    );
    return;
  }

  if (data === "remove_editor") {
    await ctx.answerCallbackQuery();

    let allSubjects: string[] = [];
    try {
      const subjectsData = await readJson<Record<string, unknown>>(SUBJECTS_DATA_FILE);
      allSubjects = Object.keys(subjectsData).filter(key => 
        Array.isArray(subjectsData[key]) && (subjectsData[key] as unknown[]).length > 0
      );
    } catch (err) {
      console.error("Ошибка загрузки предметов:", err);
    }

    if (allSubjects.length === 0) {
      await manageKeyboard(
        ctx,
        "❌ Нет доступных предметов для отстранения редактора.",
        adminKeyboard_Registration(),
        "admin",
        false
      );
      return;
    }

    await manageKeyboard(
      ctx,
      "➖ Выберите предмет для отстранения редактора:",
      adminKeyboard_SelectSubjectForRemoveEditor(allSubjects),
      "admin",
      false
    );
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
          adminKeyboard_Registration(),
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
        adminKeyboard_Registration(),
        "admin",
        false
      );
    } catch (err) {
      console.error("Ошибка загрузки данных:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка загрузки данных.",
        adminKeyboard_Registration(),
        "admin",
        false
      );
    }
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
        adminKeyboard_Registration(),
        "admin",
        false
      );
    } catch (err) {
      console.error(`Ошибка записи данных для "${subject}":`, err);

      await manageKeyboard(
        ctx,
        "❌ Ошибка при очистке БД",
        adminKeyboard_Registration(),
        "admin",
        false
      );
    }
    return;
  }

  if (data.startsWith("assign_editor_subject_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("assign_editor_subject_", "");

    let editorRequests: EditorRequest[] = [];
    try {
      editorRequests = await readJson<EditorRequest[]>(EDITOR_REQUESTS_FILE);
      if (!Array.isArray(editorRequests)) editorRequests = [];
    } catch (err) {
      editorRequests = [];
    }

    let users: Record<string, UserRecord> = {};
    try {
      users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    } catch (err) {
      users = {};
    }

    const wishers = editorRequests.filter(req => req.subjects.includes(subject));

    let text = `📋 Список желающих стать редактором по предмету «${subject}»:\n\n`;
    if (wishers.length === 0) {
      text += "Никто не подал заявку на редакторство по этому предмету.\n\n";
    } else {
      wishers.forEach((wisher, index) => {
        const user = Object.values(users).find(u => u.telegramId === wisher.telegramId);
        const isEditor = user?.editorSubjects?.includes(subject) ? " 👑" : "";
        text += `${index + 1}. ${wisher.name}${isEditor}\n`;
      });
      text += `\nℹ️ Введите ФИ пользователя (или несколько через запятую), чтобы назначить редактором.`;
    }

    ctx.session.admin.state = "awaiting_editor_fio";
    ctx.session.admin.awaitingSubject = subject;

    await manageKeyboard(
      ctx,
      text,
      adminKeyboard_SelectEditorSource(subject),
      "admin",
      false
    );
    return;
  }

  if (data.startsWith("editor_source_wishers_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("editor_source_wishers_", "");
    
    let editorRequests: EditorRequest[] = [];
    try {
      editorRequests = await readJson<EditorRequest[]>(EDITOR_REQUESTS_FILE);
      if (!Array.isArray(editorRequests)) editorRequests = [];
    } catch (err) {
      editorRequests = [];
    }

    let users: Record<string, UserRecord> = {};
    try {
      users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    } catch (err) {
      users = {};
    }

    const wishers = editorRequests.filter(req => req.subjects.includes(subject));

    let text = `📋 Список желающих стать редактором по предмету «${subject}»:\n\n`;
    if (wishers.length === 0) {
      text += "Никто не подал заявку на редакторство по этому предмету.\n\n";
    } else {
      wishers.forEach((wisher, index) => {
        const user = Object.values(users).find(u => u.telegramId === wisher.telegramId);
        const isEditor = user?.editorSubjects?.includes(subject) ? " 👑" : "";
        text += `${index + 1}. ${wisher.name}${isEditor}\n`;
      });
      text += `\nℹ️ Введите ФИ пользователя (или несколько через запятую), чтобы назначить редактором.`;
    }

    ctx.session.admin.state = "awaiting_editor_fio";
    ctx.session.admin.awaitingSubject = subject;

    await manageKeyboard(
      ctx,
      text,
      adminKeyboard_SelectEditorSource(subject),
      "admin",
      false
    );
    return;
  }

  if (data.startsWith("editor_source_all_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("editor_source_all_", "");
    
    let users: Record<string, UserRecord> = {};
    try {
      users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    } catch (err) {
      users = {};
    }

    const allUsers = Object.values(users)

    let text = "👥 Все пользователи:\n\n";
    if (allUsers.length === 0) {
      text += "Нет зарегистрированных пользователей.\n\n";
    } else {
      allUsers.forEach((user, index) => {
        const isEditor = user.editorSubjects?.includes(subject) ? " 👑" : "";
        text += `${index + 1}. ${user.fio}${isEditor}\n`;
      });
      text += `\nℹ️ Введите ФИ пользователя (или несколько через запятую), чтобы назначить редактором.`;
    }

    ctx.session.admin.state = "awaiting_editor_fio";
    ctx.session.admin.awaitingSubject = subject;

    await manageKeyboard(
      ctx,
      text,
      adminKeyboard_SelectEditorSource(subject),
      "admin",
      false
    );
    return;
  }

  if (data === "cancel_assign_editor") {
    await ctx.answerCallbackQuery();

    delete ctx.session.admin.awaitingSubject;
    delete ctx.session.admin.state;

    await manageKeyboard(
      ctx,
      "✅ Отмена назначения редактора.",
      adminKeyboard_Registration(),
      "admin",
      false
    );
    return;
  }

  if (data.startsWith("remove_editor_subject_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("remove_editor_subject_", "");
    
    let users: Record<string, UserRecord> = {};
    try {
      users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    } catch (err) {
      users = {};
    }

    const subjectEditors = Object.values(users).filter(user => 
      user.editorSubjects?.includes(subject)
    );

    let text = `👑 Редакторы по предмету «${subject}»:\n\n`;
    if (subjectEditors.length === 0) {
      text += "Нет назначенных редакторов по этому предмету.\n\n";
    } else {
      subjectEditors.forEach((editor, index) => {
        text += `${index + 1}. ${editor.fio}\n`;
      });
      text += `\nℹ️ Введите ФИ редактора (или несколько через запятую), чтобы отстранить от редакторства.`;
    }

    ctx.session.admin.state = "awaiting_remove_editor_fio";
    ctx.session.admin.awaitingSubject = subject;

    await manageKeyboard(
      ctx,
      text,
      adminKeyboard_SelectRemoveEditorSource(subject),
      "admin",
      false
    );
    return;
  }

  if (data === "cancel_remove_editor") {
    await ctx.answerCallbackQuery();

    delete ctx.session.admin.awaitingSubject;
    delete ctx.session.admin.state;

    await manageKeyboard(
      ctx,
      "✅ Отмена отстранения редактора.",
      adminKeyboard_Registration(),
      "admin",
      false
    );
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
      adminKeyboard_Registration(),
      "admin",
      false
    );
    return;
  }
}