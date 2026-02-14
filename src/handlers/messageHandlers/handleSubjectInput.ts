// src/handlers/messageHandlers/handleSubjectInput.ts\
// Preparation, Registration

import { MyContext, AllSubjectsData } from "../../types.js";
import { fetchTicketsFromSheet } from "../../storage/googleSheets.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { readJson, writeJson } from "../../storage/jsonStorage.js";
import { SUBJECTS_DATA_FILE } from "../../config.js";
import { adminKeyboard_SetDeadlines, getDeadlinesText } from "../../keyboards/keyboardAdminPreparation.js";
import { deleteMessages } from "../../utils/deleteMessages.js";
import { fastCheckPhase } from "../../utils/updatePhase.js";
import { adminKeyboard_Registration } from "../../keyboards/keyboardAdminRegistration.js";

/**
 * Обрабатывает ввод названий предметов администратором через запятую.
 * Загружает указанные предметы из Google Таблицы и сохраняет в локальное хранилище.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleSubjectInput(ctx: MyContext): Promise<void> {
  const input = ctx.message?.text?.trim();
  const chatId = ctx.chat?.id;

  await deleteMessages(ctx.api, chatId, ctx.message?.message_id);
  
  if (!input) return;

  try {
    const subjectNames = input
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (subjectNames.length === 0) return;

    let allSubjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
    
    const results: string[] = [];
    const errors: string[] = [];

    for (const subjectName of subjectNames) {
      try {
        const rawQuestions = await fetchTicketsFromSheet(subjectName);
        const questions = rawQuestions.map(q => ({
          ...q,
          assignedTo: undefined,
          status: "not_submitted" as const,
        }));

        allSubjectsData[subjectName] = questions;
        results.push(`${subjectName} (${questions.length} вопросов)`);
      } catch (err) {
        console.error(`Ошибка загрузки предмета "${subjectName}":`, err);
        errors.push(subjectName);
      }
    }

    await writeJson(SUBJECTS_DATA_FILE, allSubjectsData);

    let responseText = "\n\n✅ Загрузка завершена!\n\n";
    
    if (results.length > 0) {
      responseText += `Загружено:\n${results.map(r => `• ${r}`).join('\n')}\n\n`;
    }
    
    if (errors.length > 0) {
      responseText += `❌ Ошибки:\n${errors.map(e => `• ${e}`).join('\n')}\n\n`;
      responseText += "Проверьте правильность написания названий и наличие данных в таблице.";
    }

    delete ctx.session.admin.state;

    const currentPhase = await fastCheckPhase();

    if (currentPhase === "preparation") {
      await manageKeyboard(
        ctx,
        await getDeadlinesText(ctx.session.admin) + responseText,
        adminKeyboard_SetDeadlines(),
        "admin",
        true
      );
    } else if (currentPhase === "registration") {
      await manageKeyboard(
        ctx,
        "📋 Админ-панель (этап регистрации)",
        adminKeyboard_Registration(),
        "admin",
        true
      )
    }
  } catch (err) {
    console.error("Критическая ошибка при загрузке предметов:", err);
    await ctx.reply(`❌ Критическая ошибка: ${(err as Error).message}`);
    delete ctx.session.admin.state;
  }
}