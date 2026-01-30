// src/handlers/callbackHandlers/handleAdminRegistrationCallback.ts

import { InlineKeyboard } from "grammy";
import { MyContext, UserRecord } from "../../types.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { adminKeyboard_Editing } from "../../keyboards/keyboardAdminEditing.js";
import { AllSubjectsData } from "../../types.js";
import { fetchTicketsFromSheet, importUserAssignmentsFromSheet } from "../../storage/googleSheets.js";
import { distributeTicketsForSubject } from "../../utils/distributeTickets.js";

/**
 * Обрабатывает действия администратора на этапе редактирования.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleAdminEditingCallback(ctx: MyContext) {
  const data = ctx.callbackQuery?.data;

  if (data === "view_all_users") {
    await ctx.answerCallbackQuery();

    try {
      const users = await readJson<Record<string, UserRecord>>(USERS_FILE);

      const userList = Object.values(users)
        .map(u => `• ${u.fio} (${new Date(u.registeredAt).toLocaleDateString()})`)
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

      const keyboard = new InlineKeyboard();

      for (const subject of subjects) {
        keyboard.text(subject, `view_users_for_${subject}`).row();
      }

      keyboard.row().text("🔙 Назад", "back_to_admin_menu");

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

  if (data === "download_from_sheet") {
    await ctx.answerCallbackQuery();
    
    const keyboard = new InlineKeyboard()
      .text("🔄 С перераспределением", "mode_with_redistribution")
      .row()
      .text("✏️ Без распределения", "mode_without_redistribution")
      .row()
      .text("🔙 Назад", "back_to_admin_menu");

    await manageKeyboard(
      ctx,
      "Выберите режим загрузки:",
      keyboard,
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

      const keyboard = new InlineKeyboard();
      subjects.forEach(subject => {
        keyboard.text(subject, `download_subject_${subject}`).row();
      });
      keyboard.row().text("🔙 Назад", "back_to_admin_menu");

      await manageKeyboard(
        ctx,
        "📚 Выберите предмет для обновления:",
        keyboard,
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
      const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      if (!subjectsData[subject]) {
        throw new Error(`Предмет "${subject}" не найден в конфигурации.`);
      }
    
      subjectsData[subject].questions = tickets;
      await writeJson(SUBJECTS_DATA_FILE, subjectsData);

      let text: string;

      if (mode === "with_redistribution") {
        await distributeTicketsForSubject(subject);
      
        text = `✅ Билеты для "${subject}" перераспределены и сохранены в таблицу!`;
      } else if (mode === "without_redistribution") {
        await importUserAssignmentsFromSheet(subject);
      
        text = `✅ Распределение для "${subject}" успешно импортировано из таблицы!`;
      } else {
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

  if (data === "back_to_admin_menu") {
    await ctx.answerCallbackQuery();

    await manageKeyboard(
      ctx,
      "📋 Админ-панель (этап регистрации)",
      adminKeyboard_Editing(),
      "admin",
      false
    );
    return;
  }

  await ctx.answerCallbackQuery({
    text: "❌ Неизвестная команда.",
    show_alert: true
  });
}