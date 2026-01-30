// src/storage/googleSheets.ts

import { google } from "googleapis";
import { CREDENTIALS_PATH, SPREADSHEET_ID, USERS_FILE, SUBJECTS_DATA_FILE } from "../config.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { UserRecord, Question, AllSubjectsData } from "../types.js";

/**
 * Интеграция с Google Таблицей.
 */

/**
 * Загружает вопросы (билеты) из указанного листа таблицы.
 * @param {string} sheetName — название листа (должно совпадать с названием предмета)
 * @returns {Promise<Question[]>} массив билетов с номерами и текстом
 */
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

/**
 * Записывает ФИ студентов в колонку C листа таблицы согласно распределению билетов.
 * @param {string} subject — название предмета (соответствует имени листа)
 * @returns {Promise<void>}
 */
export async function writeAssignedUsersToSheetForSubject(subject: string): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);

  let maxNumber = 0;
  for (const user of Object.values(users)) {
    const ticketNumbers = user.assignedTickets?.[subject];
    if (ticketNumbers) {
      for (const num of ticketNumbers) {
        if (num > maxNumber) maxNumber = num;
      }
    }
  }

  if (maxNumber === 0) return;

  const assignments: string[] = new Array(maxNumber).fill("");
  
  for (const user of Object.values(users)) {
    const ticketNumbers = user.assignedTickets?.[subject];
    if (ticketNumbers) {
      for (const num of ticketNumbers) {
        if (num <= maxNumber) {
          assignments[num - 1] = user.fio;
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

/**
 * Импортирует распределение билетов из колонки C таблицы и обновляет локальные файлы.
 * @param {string} subject — название предмета (соответствует имени листа)
 * @returns {Promise<void>}
 */
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
  const fioToId = new Map<string, number>();
  for (const user of Object.values(users)) {
    if (user.fio) {
      fioToId.set(user.fio.toLowerCase().trim(), user.telegramId);
    }
  }

  const updatedUsers = JSON.parse(JSON.stringify(users)) as Record<string, UserRecord>;
  for (const userId in updatedUsers) {
    const user = updatedUsers[userId];
    if (!user.assignedTickets) user.assignedTickets = {};
  }

  for (const user of Object.values(updatedUsers)) {
    user.assignedTickets![subject] = [];
  }

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const updatedSubjectsData = JSON.parse(JSON.stringify(subjectsData)) as AllSubjectsData;
  if (!updatedSubjectsData[subject]) {
    throw new Error(`Предмет "${subject}" не найден в subjects_data.json`);
  }

  for (const q of updatedSubjectsData[subject].questions) {
    q.assignedTo = undefined;
    q.status = "not_submitted";
  }

  for (const [numStr, fioRaw] of Object.entries(assignments)) {
    const ticketNumber = parseInt(numStr);
    const normalizedFio = fioRaw.toLowerCase().trim();
    const telegramId = fioToId.get(normalizedFio);

    if (telegramId === undefined) {
      console.warn(`⚠️ Пользователь "${fioRaw}" не найден для билета №${ticketNumber}`);
      continue;
    }

    const user = updatedUsers[String(telegramId)];
    if (user && user.assignedTickets) {
      user.assignedTickets[subject].push(ticketNumber);
    }

    const question = updatedSubjectsData[subject].questions.find(q => q.number === ticketNumber);
    if (question) {
      question.assignedTo = telegramId;
      question.status = "not_submitted";
    }
  }

  for (const user of Object.values(updatedUsers)) {
    const currentSubjects = new Set(user.subjects || []);
    const hasTickets = (user.assignedTickets?.[subject] || []).length > 0;

    if (hasTickets) {
      currentSubjects.add(subject);
    } else {
      currentSubjects.delete(subject);
    }

    user.subjects = Array.from(currentSubjects);
  }

  for (const user of Object.values(updatedUsers)) {
    const tickets = user.assignedTickets?.[subject];
    if (tickets) {
      tickets.sort((a, b) => a - b);
    }
  }

  await writeJson(USERS_FILE, updatedUsers);
  await writeJson(SUBJECTS_DATA_FILE, updatedSubjectsData);
}

/**
 * Обновляет цвет ячейки в колонке C таблицы в зависимости от статуса билета.
 * @param {string} subject — название предмета
 * @param {numser} ticketNumber — номер билета (1-based)
 * @param {string} status — статус билета
 * @returns {Promise<void>}
 */
export async function updateTicketStatusInSheet(
  subject: string,
  ticketNumber: number,
  status: "not_submitted" | "pending" | "revision" | "approved"
): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Определяем строку: вопрос №1 → строка 8 → индекс строки = 7 (0-based)
  const rowIndex = 7 + (ticketNumber - 1); // C8, C9, C10, ...

  // Цвет по статусу
  const color = 
    status === "approved" ? { red: 0.7, green: 1.0, blue: 0.7 } : // зелёный
    status === "revision" ? { red: 1.0, green: 1.0, blue: 0.6 } : // жёлтый
    status === "pending"  ? { red: 0.9, green: 0.9, blue: 0.9 } : // серый
                            { red: 1.0, green: 1.0, blue: 1.0 };  // белый

  // Получаем sheetId
  const response = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const sheet = response.data.sheets?.find(s => s.properties?.title === subject);
  if (!sheet?.properties?.sheetId) {
    throw new Error(`Лист "${subject}" не найден.`);
  }
  const sheetId = sheet.properties.sheetId;

  // Обновляем цвет одной ячейки
  const requests = [{
    repeatCell: {
      range: {
        sheetId: sheetId,
        startRowIndex: rowIndex,
        endRowIndex: rowIndex + 1,
        startColumnIndex: 2, // столбец C
        endColumnIndex: 3,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: color,
        },
      },
      fields: "userEnteredFormat.backgroundColor",
    },
  }];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
}