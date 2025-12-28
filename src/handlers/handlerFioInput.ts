// src/handlers/handleFioInput.ts
import { MyContext, SubjectConfig } from "../types.js";
import { SUBJECT_CONFIG_FILE } from "../config.js";
import { saveUser } from "../storage/usersStorage.js";
import { readJson } from "../storage/jsonStorage.js";
import { keyboardSubjectSelection } from "../keyboards/keyboardSubjectSelection.js";


export async function handleFioInput(ctx: MyContext): Promise<void> {
  const text = ctx.msg?.text?.trim();
  if (!text) {
    await ctx.reply("❌ Пожалуйста, введите корректное ФИ.");
    return;
  }

  ctx.session.user.fio = text;
  await saveUser(ctx.from!.id, text);

  const subjectConfig = await readJson<SubjectConfig>(SUBJECT_CONFIG_FILE);
  const allSubjects = Object.values(subjectConfig).map(v => v.subjectAndSheetName);

  ctx.session.user.selectedSubjects = [];
  ctx.session.user.allSubjects = allSubjects;
  ctx.session.user.state = "awaiting_subject_selection";

  await ctx.reply("📚 Выберите свои предметы:", {
    reply_markup: {
      inline_keyboard: keyboardSubjectSelection([], allSubjects),
    },
  });
}