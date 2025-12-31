// src/storage/googleSheets.ts

import { google } from "googleapis";
import { CREDENTIALS_PATH, SPREADSHEET_ID, USERS_FILE } from "../config.js";
import { readJson } from "../storage/jsonStorage.js";
import { UserRecord, Question } from "../types.js";

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

export async function writeAssignedUsersToSheet() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);

  const allSubjects = new Set<string>();
  for (const user of Object.values(users)) {
    if (user.assignedTickets) {
      for (const subject of Object.keys(user.assignedTickets)) {
        allSubjects.add(subject);
      }
    }
  }

  for (const subject of allSubjects) {
    let maxNumber = 0;
    for (const user of Object.values(users)) {
      const tickets = user.assignedTickets?.[subject];
      if (tickets) {
        for (const t of tickets) {
          if (t.number > maxNumber) maxNumber = t.number;
        }
      }
    }

    if (maxNumber === 0) continue;

    const assignments: string[] = new Array(maxNumber).fill("");
    for (const user of Object.values(users)) {
      const tickets = user.assignedTickets?.[subject];
      if (tickets) {
        for (const ticket of tickets) {
          assignments[ticket.number - 1] = user.fio;
        }
      }
    }

    const values = assignments.map(fio => [fio]);

    const range = `${subject}!C8:C${7 + values.length}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });
  }
}