// src/utils/distributeTickets.ts
import { UserRecord, TicketsBySubject } from "../types.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { TICKETS_FILE, USERS_FILE } from "../config.js";
import { writeAssignedUsersToSheet } from "../storage/googleSheets.js";

export async function distributeTickets() {
  const usersRaw = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const tickets = await readJson<TicketsBySubject>(TICKETS_FILE);

  const allUsers = Object.values(usersRaw).filter(u => u.subjects?.length);
  allUsers.sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());

  const result: Record<string, UserRecord> = {};
  for (const user of allUsers) {
    result[user.telegramId] = { ...user, assignedTickets: {} };
  }

  const allSubjects = new Set<string>();
  for (const user of allUsers) {
    for (const subject of user.subjects || []) {
      allSubjects.add(subject);
    }
  }

  for (const subject of allSubjects) {
    const subjectTickets = tickets[subject];
    if (!subjectTickets || subjectTickets.length === 0) continue;

    const usersInSubject = allUsers.filter(u => u.subjects?.includes(subject));
    const totalUsers = usersInSubject.length;
    const totalTickets = subjectTickets.length;

    if (totalUsers === 0) continue;

    const reorderedTickets: typeof subjectTickets = [];
    let left = 0;
    let right = subjectTickets.length - 1;
    let takeFromLeft = true;

    while (left <= right) {
      if (takeFromLeft) {
        reorderedTickets.push(subjectTickets[left]);
        left++;
      } else {
        reorderedTickets.push(subjectTickets[right]);
        right--;
      }
      takeFromLeft = !takeFromLeft;
    }

    const q = Math.floor(totalTickets / totalUsers);
    const r = totalTickets % totalUsers;

    let index = 0;

    for (let i = 0; i < totalUsers - r; i++) {
      result[usersInSubject[i].telegramId].assignedTickets![subject] = reorderedTickets.slice(index, index + q);
      index += q;
    }

    for (let i = totalUsers - r; i < totalUsers; i++) {
      result[usersInSubject[i].telegramId].assignedTickets![subject] = reorderedTickets.slice(index, index + q + 1);
      index += q + 1;
    }
  }

  for (const user of Object.values(result)) {
    if (user.assignedTickets) {
      for (const subject in user.assignedTickets) {
        user.assignedTickets[subject].sort((a, b) => a.number - b.number);
      }
    }
  }

  await writeJson(USERS_FILE, result);
  await writeAssignedUsersToSheet();
  return { outputFile: USERS_FILE };
}
