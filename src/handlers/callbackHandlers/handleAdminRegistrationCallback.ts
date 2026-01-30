// src/handlers/callbackHandlers/handleAdminRegistrationCallback.ts

import { InlineKeyboard } from "grammy";
import { MyContext, UserRecord } from "../../types.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { adminKeyboard_Registration } from "../../keyboards/keyboardAdminRegistration.js";
import { AllSubjectsData } from "../../types.js";

/**
 * Обрабатывает действия администратора на этапе регистрации (просмотр пользователей и статистики).
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleAdminRegistrationCallback(ctx: MyContext) {
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

  if (data === "back_to_admin_menu") {
    await ctx.answerCallbackQuery();

    await manageKeyboard(
      ctx,
      "📋 Админ-панель (этап регистрации)",
      adminKeyboard_Registration(),
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