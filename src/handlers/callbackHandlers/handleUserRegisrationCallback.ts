// src/handlers/callbackHandlers/handleUserRegistrationCallback.ts

import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../../config.js";
import { keyboardSubjectSelection, userKeyboard_Registration } from "../../keyboards/keyboardUserRegistration.js";
import { MyContext, UserRecord, AllSubjectsData, EditorRequest } from "../../types.js";
import { EDITOR_REQUESTS_FILE } from "../../config.js";
import { keyboardEditorSubjectSelection } from "../../keyboards/keyboardUserRegistration.js";

/**
 * Обрабатывает изменение списка предметов пользователем на этапе регистрации.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
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

/**
 * Обрабатывает выбор/отмену предметов в интерфейсе регистрации.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
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
      delete ctx.session.user.fio;

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
      delete ctx.session.user.fio;

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

  await ctx.answerCallbackQuery({
    text: "❌ Неизвестная команда.",
    show_alert: true
  });
}

/**
 * Обрабатывает запрос пользователя на роль редактора.
 * Загружает его текущие (если есть) или пустые выбранные предметы для редакторства.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleBecomeEditorCallback(ctx: MyContext) {
  await ctx.answerCallbackQuery();

  let allSubjects: string[] = [];
  try {
    const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
    allSubjects = Object.keys(subjectsData);
  } catch (err) {
    console.error("Ошибка загрузки предметов для редакторства:", err);
    await ctx.answerCallbackQuery("❌ Ошибка загрузки списка предметов.");
    return;
  }

  let editorRequests = await readJson<EditorRequest[]>(EDITOR_REQUESTS_FILE);
  if (!Array.isArray(editorRequests)) editorRequests = [];

  const userId = ctx.from?.id;
  if (!userId) return;

  const existingRequest = editorRequests.find(req => req.telegramId === userId);
  const selected = existingRequest ? existingRequest.subjects : [];

  ctx.session.user.state = "awaiting_editor_subject_selection";
  ctx.session.user.selectedEditorSubjects = [...selected];

  const keyboard = keyboardEditorSubjectSelection(selected, allSubjects);

  await manageKeyboard(
    ctx,
    "👑 Выберите предметы, по которым хотите стать редактором:",
    keyboard,
    "user",
    false
  );
}

/**
 * Обрабатывает выбор предметов и подтверждение заявки на редакторство.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleEditorSubjectSelectionCallback(ctx: MyContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  if (data.startsWith("editor_toggle_")) {
    await ctx.answerCallbackQuery();

    const subject = data.replace("editor_toggle_", "");
    const selected = ctx.session.user.selectedEditorSubjects || [];
    const index = selected.indexOf(subject);

    if (index === -1) {
      selected.push(subject);
    } else {
      selected.splice(index, 1);
    }

    ctx.session.user.selectedEditorSubjects = selected;

    let allSubjects: string[] = [];
    try {
      const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
      allSubjects = Object.keys(subjectsData);
    } catch (err) {
      console.error("Ошибка загрузки предметов:", err);
      await ctx.answerCallbackQuery("❌ Ошибка загрузки предметов.");
      return;
    }

    const keyboard = keyboardEditorSubjectSelection(selected, allSubjects);

    await manageKeyboard(
      ctx,
      "👑 Выберите предметы, по которым хотите стать редактором:",
      keyboard,
      "user",
      false
    );
    return;
  }

  if (data === "editor_subjects_done") {
    await ctx.answerCallbackQuery();

    const selected = ctx.session.user.selectedEditorSubjects || [];
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.reply("❌ Не удалось определить ваш ID.");
      return;
    }

    let users: Record<string, UserRecord> = {};
    try {
      users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
    }

    const user = users[String(userId)];
    const name = user?.fio || "Пользователь";

    let editorRequests = await readJson<EditorRequest[]>(EDITOR_REQUESTS_FILE);
    if (!Array.isArray(editorRequests)) editorRequests = [];

    const existingIndex = editorRequests.findIndex(req => req.telegramId === userId);
    const newRequest: EditorRequest = { telegramId: userId, name, subjects: selected };

    if (existingIndex !== -1) {
      editorRequests[existingIndex] = newRequest;
    } else {
      editorRequests.push(newRequest);
    }

    try {
      await writeJson(EDITOR_REQUESTS_FILE, editorRequests);
    } catch (err) {
      console.error("Ошибка сохранения заявки на редакторство:", err);
      await manageKeyboard(
        ctx,
        "❌ Ошибка отправки заявки. Попробуйте позже.",
        undefined,
        "user",
        false
      );
      return;
    }

    delete ctx.session.user.state;
    delete ctx.session.user.selectedEditorSubjects;

    await manageKeyboard(
      ctx,
      selected.length > 0
        ? `✅ Ваша заявка на редакторство отправлена!\nПредметы: ${selected.join(", ")}`
        : "✅ Вы отправили заявку, но не выбрали ни одного предмета.",
      userKeyboard_Registration(),
      "user",
      false
    );
    return;
  }

  if (data === "editor_subjects_cancel") {
    await ctx.answerCallbackQuery();
    delete ctx.session.user.state;
    delete ctx.session.user.selectedEditorSubjects;

    await manageKeyboard(
      ctx,
      "❌ Отмена выбора предметов для редакторства.",
      userKeyboard_Registration(),
      "user",
      false
    );
    return;
  }
}