import { MyContext } from "../types.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../config.js";
import { keyboardSubjectSelection } from "../keyboards/keyboardUserRegistration.js";
import { updateCurrentPhase } from "../utils/updatePhase.js";
import { AllSubjectsData, UserRecord } from "../types.js";

export async function handleFioInput(ctx: MyContext) {
  updateCurrentPhase(ctx.session.admin);

  if (ctx.session.admin.currentPhase !== "registration") { // Переписать
    await manageKeyboard(
      ctx,
      "❌ Регистрация завершена.",
      undefined,
      "user",
      true
    );
    delete ctx.session.user.state;
    return;
  }

  const fio = ctx.message?.text?.trim();

  if (!fio) {
    await manageKeyboard(
      ctx,
      "❌ Введите корректные фамилию и имя.",
      undefined,
      "user",
      true
    );
    return;
  }

  try {
    let users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    const userId = String(ctx.from?.id);

    users[userId] = {
      telegramId: ctx.from!.id,
      fio: fio,
      registeredAt: new Date().toISOString(),
      subjects: [],
    };

    await writeJson(USERS_FILE, users);
  } catch (err) {
    console.error("Ошибка сохранения ФИ:", err);
    await manageKeyboard(
      ctx,
      "❌ Ошибка сохранения данных.",
      undefined,
      "user",
      false
    );
    return;
  }

  ctx.session.user.fio = fio;

  let allSubjects: string[] = [];

  try {
    const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
    allSubjects = Object.keys(subjectsData);
  } catch (err) {
    console.error("Ошибка загрузки предметов:", err);
    await manageKeyboard(
      ctx,
      "❌ Ошибка загрузки списка предметов.",
      undefined,
      "user",
      true
    );
    delete ctx.session.user.state;
    return;
  }

  ctx.session.user.state = "awaiting_subject_selection";
  ctx.session.user.selectedSubjects = [];

  const keyboard = keyboardSubjectSelection(ctx.session.user.selectedSubjects, allSubjects);

  await manageKeyboard(
    ctx,
    "Выберите предметы, которые хотите готовить:",
    keyboard,
    "user",
    true
  );
}