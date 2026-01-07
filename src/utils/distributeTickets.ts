// src/utils/distributeTickets.ts

import { UserRecord, Question, AllSubjectsData } from "../types.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { SUBJECTS_DATA_FILE, USERS_FILE } from "../config.js";
import { writeAssignedUsersToSheetForSubject } from "../storage/googleSheets.js";

export async function distributeTicketsForSubject(subject: string): Promise<void> {
  const usersRaw = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);

  if (!subjectsData[subject]) {
    throw new Error(`Предмет "${subject}" не найден в данных.`);
  }
  
  const subjectTickets = subjectsData[subject].questions;
  if (!subjectTickets || subjectTickets.length === 0) {
    throw new Error(`В предмете "${subject}" нет вопросов.`);
  }

  const usersInSubject = Object.values(usersRaw)
    .filter(user => 
      user.subjects?.includes(subject) && 
      user.fio?.trim() !== ""
    )
    .sort((a, b) => 
      new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime()
    );

  if (usersInSubject.length === 0) {
    throw new Error(`Нет пользователей, записанных на предмет "${subject}".`);
  }

  const updatedUsers: Record<string, UserRecord> = {};

  for (const [userId, user] of Object.entries(usersRaw)) {
    updatedUsers[userId] = {
      ...user,
      assignedTickets: user.assignedTickets 
        ? { ...user.assignedTickets } 
        : {}
    };

    if (updatedUsers[userId].assignedTickets) {
      delete updatedUsers[userId].assignedTickets[subject];
    }
  }

  const reorderedTickets = reorderTickets(subjectTickets);
  const totalUsers = usersInSubject.length;
  const totalTickets = reorderedTickets.length;
  const q = Math.floor(totalTickets / totalUsers);
  const r = totalTickets % totalUsers;
  let index = 0;

  for (let i = 0; i < totalUsers - r; i++) {
    const user = usersInSubject[i];
    const userId = String(user.telegramId);
    
    if (!updatedUsers[userId].assignedTickets) {
      updatedUsers[userId].assignedTickets = {};
    }
    
    updatedUsers[userId].assignedTickets[subject] = 
      reorderedTickets.slice(index, index + q);
    index += q;
  }

  for (let i = totalUsers - r; i < totalUsers; i++) {
    const user = usersInSubject[i];
    const userId = String(user.telegramId);
    
    if (!updatedUsers[userId].assignedTickets) {
      updatedUsers[userId].assignedTickets = {};
    }
    
    updatedUsers[userId].assignedTickets[subject] = 
      reorderedTickets.slice(index, index + q + 1);
    index += q + 1;
  }

  for (const user of usersInSubject) {
    const userId = String(user.telegramId);
    const tickets = updatedUsers[userId].assignedTickets?.[subject];
    
    if (tickets) {
      tickets.sort((a, b) => a.number - b.number);
    }
  }

  await writeJson(USERS_FILE, updatedUsers);
  await writeAssignedUsersToSheetForSubject(subject);
}

function reorderTickets(tickets: Question[]): Question[] {
  const reordered: Question[] = [];
  let left = 0;
  let right = tickets.length - 1;
  let takeFromLeft = true;

  while (left <= right) {
    if (takeFromLeft) {
      reordered.push(tickets[left++]);
    } else {
      reordered.push(tickets[right--]);
    }
    takeFromLeft = !takeFromLeft;
  }

  return reordered;
}

export async function distributeTickets(): Promise<void> {
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const subjects = Object.keys(subjectsData);
  
  for (const subject of subjects) {
    try {
      await distributeTicketsForSubject(subject);
    } catch (err) {
      console.warn(`Не удалось распределить билеты для предмета "${subject}":`, err);
    }
  }
}
