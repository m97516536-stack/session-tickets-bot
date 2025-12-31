// src/handlers/hendleSubjectInput.ts

import { MyContext, SubjectData } from "../types.js";
import { fetchTicketsFromSheet } from "../storage/googleSheets.js";
import { manageKeyboard } from "../utils/manageKeyboard.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { SUBJECTS_DATA_FILE } from "../config.js";

export async function handleSubjectInput(ctx: MyContext) {
  if (ctx.session.admin.currentPhase !== undefined) {
    delete ctx.session.admin.state;
    delete ctx.session.admin.awaitingSubjectThreadId;
    return;
  }

  const subjectName = ctx.message?.text?.trim();
  const threadId = ctx.session.admin.awaitingSubjectThreadId;

  if (!subjectName || !threadId) {
    await ctx.reply("❌ Состояние повреждено или не введено название предмета. Повторите /init.");
    ctx.session.admin.state = undefined;
    ctx.session.admin.awaitingSubjectThreadId = undefined;
    return;
  }

  try {
    let allSubjectsData = await readJson<Record<string, SubjectData>>(SUBJECTS_DATA_FILE);

    let oldSubjectName: string | undefined;

    for (const [subj, data] of Object.entries(allSubjectsData)) {
      if (data.chatId === String(threadId)) {
        oldSubjectName = subj;
        break;
      }
    }

    if (oldSubjectName) {
      delete allSubjectsData[oldSubjectName];
    }

    const questions = await fetchTicketsFromSheet(subjectName);

    allSubjectsData[subjectName] = {
      chatId: String(threadId),
      questions,
    };

    await writeJson(SUBJECTS_DATA_FILE, allSubjectsData);

    delete ctx.session.admin.state;
    delete ctx.session.admin.awaitingSubjectThreadId;

    await manageKeyboard(
      ctx,
      `✅ Предмет "${subjectName}" успешно инициализирован в теме ${threadId}!\nКоличество вопросов: ${questions.length}`,
      undefined,
      "init",
      true
    );

  } catch (err) {
    console.error("Ошибка при инициализации предмета:", err);
    await manageKeyboard(
      ctx,
      `❌ Ошибка при загрузке данных для "${subjectName}": ${(err as Error).message}`,
      undefined,
      "init",
      true
    );

    delete ctx.session.admin.state;
    delete ctx.session.admin.awaitingSubjectThreadId;
  }
}