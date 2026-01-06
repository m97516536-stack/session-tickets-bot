// src/handlers/callbackHandlers/handleUserRegistrationCallback.ts

import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { keyboardSubjectSelection, userKeyboard_Registration } from "../../keyboards/keyboardUserRegistration.js";
import { MyContext, UserRecord, AllSubjectsData } from "../../types.js";

export async function handleChangeSubjectsCallback(ctx: MyContext) {
  await ctx.answerCallbackQuery();

  let allSubjects: string[] = [];

  try {
    const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
    allSubjects = Object.keys(subjectsData);
  } catch (err) {
    console.error("Ошибка загрузки предметов:", err);
    await ctx.answerCallbackQuery("❌ Ошибка загрузки предметов.");
    return;
  }

  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const userId = String(ctx.from?.id);
  const user = users[userId];

  if (!user) {
    await ctx.answerCallbackQuery("❌ Пользователь не найден.");
    return;
  }

  const selected = user.subjects || [];

  ctx.session.user.state = "awaiting_subject_selection";
  ctx.session.user.selectedSubjects = [...selected];

  const keyboard = keyboardSubjectSelection(ctx.session.user.selectedSubjects, allSubjects);

  await manageKeyboard(
    ctx,
    "Выберите предметы, которые хотите готовить:",
    keyboard,
    "user",
    false
  );

  return;
}

export async function handleSubjectSelectionCallback(ctx: MyContext) {
  const data = ctx.callbackQuery?.data;

  if (data?.startsWith("toggle_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("toggle_", "");
    const selected = ctx.session.user.selectedSubjects || [];
    const index = selected.indexOf(subject);

    if (index === -1) {
      selected.push(subject);
    } else {
      selected.splice(index, 1);
    }

    ctx.session.user.selectedSubjects = selected;

    let allSubjects: string[] = [];

    try {
      const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      allSubjects = Object.keys(subjectsData);
    } catch (err) {
      console.error("Ошибка загрузки предметов:", err);
      await ctx.answerCallbackQuery("❌ Ошибка загрузки предметов.");
      return;
    }

    const keyboard = keyboardSubjectSelection(selected, allSubjects);

    await manageKeyboard(
      ctx,
      "Выберите предметы, которые хотите готовить:",
      keyboard,
      "user",
      false
    );

    return;
  }

  if (data === "subjects_done") {
    await ctx.answerCallbackQuery();

    const selected = ctx.session.user.selectedSubjects || [];

    try {
      const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
      const userId = String(ctx.from?.id);
      const user = users[userId];

      if (!user) {
        await manageKeyboard(
          ctx,
          "❌ Пользователь не найден.",
          undefined,
          "user",
          false
        );
        return;
      }

      const fio = user.fio;

      users[userId] = {
        ...user,
        subjects: selected,
      };

      await writeJson(USERS_FILE, users);

      delete ctx.session.user.state;
      delete ctx.session.user.selectedSubjects;

      await manageKeyboard(
        ctx,
        `✅ Вы успешно зарегистрировались!\nФИ: ${fio}\nПредметы: ${selected.join(", ")}`,
        userKeyboard_Registration(),
        "user",
        false
      );
    } catch (err) {
      console.error("Ошибка сохранения пользователя:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка сохранения данных.",
        undefined,
        "user",
        false
      );
    }
    return;
  }

  if (data === "subjects_cancel") {
    await ctx.answerCallbackQuery();

    try {
      const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
      const userId = String(ctx.from?.id);
      const user = users[userId];

      if (!user) {
        await manageKeyboard(
          ctx,
          "❌ Пользователь не найден.",
          undefined,
          "user",
          false
        );
        return;
      }

      const fio = user.fio;

      users[userId] = {
        ...user,
        subjects: [],
      };

      await writeJson(USERS_FILE, users);

      delete ctx.session.user.state;
      delete ctx.session.user.selectedSubjects;

      await manageKeyboard(
        ctx,
        `✅ Вы успешно зарегистрировались!\nФИ: ${fio}\nПредметы: не выбраны`,
        userKeyboard_Registration(),
        "user",
        false
      );
    } catch (err) {
      console.error("Ошибка сохранения пользователя:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка сохранения данных.",
        undefined,
        "user",
        false
      );
    }
    return;
  }
}