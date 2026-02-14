// src/utils/deleteSubject.ts

import { readJson, writeJson } from "../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE, ADMIN_IDS } from "../config.js";
import { UserRecord, AllSubjectsData } from "../types.js";
import { fastCheckPhase } from "./updatePhase.js";

/**
 * Удаляет предмет из всех данных и очищает пользователей без билетов.
 * @param {string} subject - название предмета для удаления
 * @returns {Promise<string>} текстовый результат операции
 */
export async function deleteSubject(subject: string): Promise<string> {
  try {
    const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
    if (!subjectsData[subject]) {
      return `❌ Предмет "${subject}" не найден.`;
    }
    const phase = await fastCheckPhase();

    delete subjectsData[subject];
    await writeJson(SUBJECTS_DATA_FILE, subjectsData);

    const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    const validUsers: Record<string, UserRecord> = {};
    const removedUsers: { id: string; fio: string }[] = [];

    for (const [userId, user] of Object.entries(users)) {
      if (user.assignedTickets && user.assignedTickets[subject]) {
        delete user.assignedTickets[subject];
      }

      if (user.assignedEditorTickets && user.assignedEditorTickets[subject]) {
        delete user.assignedEditorTickets[subject];
      }

      if (user.subjects) {
        user.subjects = user.subjects.filter(s => s !== subject);
      }

      if (user.editorSubjects) {
        user.editorSubjects = user.editorSubjects.filter(s => s !== subject);

        if (user.editorSubjects.length === 0) {
          user.editor = false;
          delete user.editorSubjects;
        }
      }

      const hasTickets = user.assignedTickets && Object.values(user.assignedTickets).some(tickets => tickets.length > 0);
      
      const isEditor = user.editorSubjects && user.editorSubjects.length > 0;

      let isValidUser: boolean | undefined;

      if (phase === "registration" || phase === "editing" || ADMIN_IDS.includes(user.telegramId)) {
        isValidUser = true;
      } else {
        isValidUser = hasTickets || isEditor;
      }

      if (isValidUser) {
        validUsers[userId] = user;
      } else {
        removedUsers.push({ id: userId, fio: user.fio || 'Безымянный' });
      }
    }

    await writeJson(USERS_FILE, validUsers);

    let resultText = `✅ Предмет "${subject}" успешно удалён!\n`;

    if (removedUsers.length > 0) {
      resultText += `\n🗑️ Удалено пользователей без билетов: ${removedUsers.length}\n`;
      resultText += `Список: ${removedUsers.map(u => `${u.fio} (${u.id})`).join(', ')}`;
    }

    return resultText;

  } catch (err) {
    console.error("Ошибка при удалении предмета:", err);
    return `❌ Ошибка при удалении предмета "${subject}":\n${err instanceof Error ? err.message : 'Неизвестная ошибка'}`;
  }
}