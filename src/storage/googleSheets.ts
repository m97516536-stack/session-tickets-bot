// src/storage/googleSheets.ts

import { google } from "googleapis";
import { CREDENTIALS_PATH, SPREADSHEET_ID, USERS_FILE, SUBJECTS_DATA_FILE } from "../config.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { UserRecord, Question, AllSubjectsData } from "../types.js";

export async function fetchTicketsFromSheet(sheetName: string): Promise<Question[]> {
  const cleanSheetName = sheetName.trim();

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const range = `${cleanSheetName}!B8:B`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = response.data.values || [];
  const tickets: Question[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cellValue = rows[i]?.[0];
    const rawText = cellValue?.toString().trim();
    if (!rawText) break;
    const cleanText = rawText.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    tickets.push({ number: i + 1, text: cleanText });
  }

  return tickets;
}

export async function writeAssignedUsersToSheetForSubject(subject: string): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);

  let maxNumber = 0;
  for (const user of Object.values(users)) {
    const tickets = user.assignedTickets?.[subject];
    if (tickets) {
      for (const ticket of tickets) {
        if (ticket.number > maxNumber) maxNumber = ticket.number;
      }
    }
  }

  if (maxNumber === 0) return;

  const assignments: string[] = new Array(maxNumber).fill("");
  
  for (const user of Object.values(users)) {
    const tickets = user.assignedTickets?.[subject];
    if (tickets) {
      for (const ticket of tickets) {
        if (ticket.number <= maxNumber) {
          assignments[ticket.number - 1] = user.fio;
        }
      }
    }
  }

  const values = assignments.map(fio => [fio]);

  const range = `${subject}!C8:C${7 + values.length}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

// НОВАЯ ФУНКЦИЯ: загрузка распределения пользователей ИЗ таблицы для одного предмета
export async function importUserAssignmentsFromSheet(subject: string): Promise<void> {
  const cleanSheetName = subject.trim();

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const range = `${cleanSheetName}!C8:C`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = response.data.values || [];
  const assignments: Record<number, string> = {};

  for (let i = 0; i < rows.length; i++) {
    const cellValue = rows[i]?.[0]?.toString().trim() || "";
    if (cellValue !== "") {
      assignments[i + 1] = cellValue;
    }
  }

  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);

  const fioMap = new Map<string, UserRecord>();
  for (const user of Object.values(users)) {
    if (user.fio) {
      const normalizedFio = user.fio.toLowerCase().trim();
      fioMap.set(normalizedFio, user);
    }
  }

  for (const user of Object.values(users)) {
    if (user.assignedTickets?.[subject]) {
      user.assignedTickets[subject] = [];
    }
  }

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const subjectTickets = subjectsData[subject]?.questions || [];

  for (const [ticketNumberStr, fioRaw] of Object.entries(assignments)) {
    const ticketNumber = parseInt(ticketNumberStr);
    const normalizedFio = fioRaw.toLowerCase().trim();

    const user = fioMap.get(normalizedFio);
    if (!user) {
      console.warn(`⚠️ Пользователь "${fioRaw}" не найден для билета №${ticketNumber} в предмете "${subject}"`);
      continue;
    }

    const ticket = subjectTickets.find(t => t.number === ticketNumber);
    if (!ticket) {
      console.warn(`⚠️ Билет №${ticketNumber} не найден в предмете "${subject}"`);
      continue;
    }

    if (!user.assignedTickets) {
      user.assignedTickets = {};
    }
    if (!user.assignedTickets[subject]) {
      user.assignedTickets[subject] = [];
    }

    user.assignedTickets[subject].push({
      number: ticketNumber,
      text: ticket.text
    });
  }

  for (const user of Object.values(users)) {
    const tickets = user.assignedTickets?.[subject];
    if (tickets) {
      tickets.sort((a, b) => a.number - b.number);
    }
  }

  await writeJson(USERS_FILE, users);
}
