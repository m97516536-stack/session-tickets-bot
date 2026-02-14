// src/utils/distributeEditorTickets.ts

import { readJson, writeJson } from "../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../config.js";
import { UserRecord, AllSubjectsData, Question } from "../types.js";
import { writeEditorAssignmentsToSheetForSubject } from "../storage/googleSheets.js";

/**
 * Распределяет билеты между редакторами для каждого предмета.
 * Алгоритм: первый редактор получает первые N билетов, второй — следующие N, и т.д.
 * При нечётном количестве первый редактор получает "лишний" билет.
 * @returns {Promise<void>}
 */
export async function distributeEditorTickets(): Promise<void> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);

  for (const [subject, tickets] of Object.entries(subjectsData)) {
    const editors = Object.values(users).filter(user => 
      user.editorSubjects?.includes(subject)
    );

    if (editors.length === 0) {
      console.log(`ℹ️ Нет редакторов по предмету "${subject}", пропускаем`);
      continue;
    }

    editors.sort((a, b) => a.telegramId - b.telegramId);

    const totalTickets = tickets.length;
    const baseCount = Math.floor(totalTickets / editors.length);
    let remainder = totalTickets % editors.length;

    let startIndex = 0;
    for (let i = 0; i < editors.length; i++) {
      const editor = editors[i];
      const count = baseCount + (i < remainder ? 1 : 0);
      
      if (count === 0) continue;

      const editorTicketNumbers = tickets
        .slice(startIndex, startIndex + count)
        .map(ticket => ticket.number);

      for (let j = startIndex; j < startIndex + count; j++) {
        (tickets[j] as Question).assignedEditorId = editor.telegramId;
      }

      if (!editor.assignedEditorTickets) editor.assignedEditorTickets = {};
      editor.assignedEditorTickets[subject] = editorTicketNumbers;
      editor.editor = true;

      console.log(`📝 ${editor.fio} назначен редактором по "${subject}" на билеты: ${editorTicketNumbers.join(", ")}`);

      startIndex += count;
    }
  }

  await writeJson(USERS_FILE, users);
  await writeJson(SUBJECTS_DATA_FILE, subjectsData);

  console.log("✅ Распределение билетов редакторам завершено");

  for (const subject of Object.keys(subjectsData)) {
    try {
      await writeEditorAssignmentsToSheetForSubject(subject);
    } catch (err) {
      console.warn(`⚠️ Не удалось записать редакторов в таблицу для "${subject}":`, err);
    }
  }

  console.log("✅ Запись редакторов в таблицу завершена");
}

/**
 * Распределяет билеты между редакторами для одного предмета.
 * Алгоритм: первый редактор получает первые N билетов, второй — следующие N, и т.д.
 * @param {string} subject - название предмета
 * @returns {Promise<void>}
 */
export async function distributeEditorTicketsForSubject(subject: string): Promise<void> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);

  if (!subjectsData[subject]) {
    throw new Error(`Предмет "${subject}" не найден в данных.`);
  }

  const tickets = subjectsData[subject];
  if (!tickets || tickets.length === 0) {
    throw new Error(`В предмете "${subject}" нет вопросов.`);
  }

  const currentEditors = Object.values(users).filter(user => 
    user.editorSubjects?.includes(subject)
  );

  if (currentEditors.length === 0) {
    throw new Error(`Нет редакторов, назначенных на предмет "${subject}".`);
  }

  currentEditors.sort((a, b) => a.telegramId - b.telegramId);

  const updatedUsers = JSON.parse(JSON.stringify(users)) as Record<string, UserRecord>;
  
  for (const user of Object.values(updatedUsers)) {
    if (user.editorSubjects) {
      user.editorSubjects = user.editorSubjects.filter(s => s !== subject);

      if (user.editorSubjects.length === 0) {
        user.editor = false;
        delete user.editorSubjects;
      }
    }

    if (user.assignedEditorTickets) {
      delete user.assignedEditorTickets[subject];
    }
  }

  const totalTickets = tickets.length;
  const baseCount = Math.floor(totalTickets / currentEditors.length);
  let remainder = totalTickets % currentEditors.length;

  let startIndex = 0;
  for (let i = 0; i < currentEditors.length; i++) {
    const editor = currentEditors[i];
    const count = baseCount + (i < remainder ? 1 : 0);
    
    if (count === 0) continue;

    const editorTicketNumbers = tickets
      .slice(startIndex, startIndex + count)
      .map(ticket => ticket.number);

    for (let j = startIndex; j < startIndex + count; j++) {
      (tickets[j] as Question).assignedEditorId = editor.telegramId;
    }

    const editorUser = updatedUsers[String(editor.telegramId)];
    if (editorUser) {
      editorUser.editor = true;
      if (!editorUser.editorSubjects) editorUser.editorSubjects = [];
      if (!editorUser.editorSubjects.includes(subject)) {
        editorUser.editorSubjects.push(subject);
      }
      
      if (!editorUser.assignedEditorTickets) editorUser.assignedEditorTickets = {};
      editorUser.assignedEditorTickets[subject] = editorTicketNumbers;
    }

    console.log(`📝 ${editor.fio} назначен редактором по "${subject}" на билеты: ${editorTicketNumbers.join(", ")}`);
    startIndex += count;
  }

  await writeJson(USERS_FILE, updatedUsers);
  await writeJson(SUBJECTS_DATA_FILE, subjectsData);

  console.log(`✅ Распределение билетов редакторам для "${subject}" завершено`);

  try {
    await writeEditorAssignmentsToSheetForSubject(subject);
    console.log(`✅ Запись редакторов в таблицу для "${subject}" завершена`);
  } catch (err) {
    console.warn(`⚠️ Не удалось записать редакторов в таблицу для "${subject}":`, err);
  }
}