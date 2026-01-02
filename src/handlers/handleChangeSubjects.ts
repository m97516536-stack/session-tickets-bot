// src/handlers/handleChangeSubjects.ts

import { MyContext, UserRecord, AllSubjectsData } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { readJson } from "../storage/jsonStorage.js";
import { SUBJECTS_DATA_FILE, USERS_FILE } from "../config.js";
import { keyboardSubjectSelection } from "../keyboards/keyboardUserRegistration.js";
import { updateCurrentPhase } from "../utils/updatePhase.js";

export async function handleChangeSubjects(ctx: MyContext) {
  updateCurrentPhase(ctx.session.admin);

  if (ctx.session.admin.currentPhase !== "registration") {  // Переписать
    await ctx.answerCallbackQuery("❌ Регистрация завершена.");
    return;
  }

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

  await ctx.answerCallbackQuery();
}