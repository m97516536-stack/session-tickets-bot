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
  
  for (const user of Object.values(updatedUsers)) {
    if (user.assignedTickets) {
      user.assignedTickets[subject] = [];
    }

    if (user.subjects) {
      user.subjects = user.subjects.filter(s => s !== subject);
    }
  }

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const updatedSubjectsData = JSON.parse(JSON.stringify(subjectsData)) as AllSubjectsData;
  
  if (!updatedSubjectsData[subject]) {
    throw new Error(`Предмет "${subject}" не найден в subjects_data.json`);
  }

  for (const q of updatedSubjectsData[subject]) {
    q.assignedTo = undefined;
    q.status = "not_submitted";
  }

  for (const [numStr, fioRaw] of Object.entries(assignments)) {
    const ticketNumber = parseInt(numStr);
    const normalizedFio = fioRaw.toLowerCase().trim();
    const telegramId = fioToId.get(normalizedFio);

    if (telegramId === undefined) {
      console.warn(`⚠️ Студент "${fioRaw}" не найден для билета №${ticketNumber}`);
      continue;
    }

    const user = updatedUsers[String(telegramId)];
    if (user && user.assignedTickets) {
      user.assignedTickets[subject].push(ticketNumber);

      if (!user.subjects) user.subjects = [];
      if (!user.subjects.includes(subject)) {
        user.subjects.push(subject);
      }
    }

    const question = updatedSubjectsData[subject].find(q => q.number === ticketNumber);
    if (question) {
      question.assignedTo = telegramId;
      question.status = "not_submitted";
    }
  }

  for (const user of Object.values(updatedUsers)) {
    const tickets = user.assignedTickets?.[subject];
    if (tickets) tickets.sort((a, b) => a - b);
  }

  await writeJson(USERS_FILE, updatedUsers);
  await writeJson(SUBJECTS_DATA_FILE, updatedSubjectsData);
  
  console.log(`✅ Импортировано распределение студентов для "${subject}"`);
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

  const rowIndex = 7 + (ticketNumber - 1);

  const color = 
    status === "approved" ? { red: 0.486, green: 0.651, blue: 0.055 } : // зелёный
    status === "revision" ? { red: 0.984, green: 0.733, blue: 0.016 } : // жёлтый
    status === "pending"  ? { red: 0.718, green: 0.718, blue: 0.718 } : // серый
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

  const requests = [{
    repeatCell: {
      range: {
        sheetId: sheetId,
        startRowIndex: rowIndex,
        endRowIndex: rowIndex + 1,
        startColumnIndex: 2,
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

/**
 * Записывает ФИ редакторов в колонку D листа таблицы согласно распределению билетов.
 * Автоматически объединяет ячейки для последовательных билетов одного редактора.
 * Перед записью очищает все существующие объединения в колонке D.
 * @param {string} subject — название предмета (соответствует имени листа)
 * @returns {Promise<void>}
 */
export async function writeEditorAssignmentsToSheetForSubject(subject: string): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);

  let maxNumber = 0;
  for (const user of Object.values(users)) {
    const ticketNumbers = user.assignedEditorTickets?.[subject];
    if (ticketNumbers) {
      for (const num of ticketNumbers) {
        if (num > maxNumber) maxNumber = num;
      }
    }
  }

  if (maxNumber === 0) {
    console.log(`ℹ️ Нет билетов для редакторов по предмету "${subject}", пропускаем`);
    return;
  }

  const assignments: string[] = new Array(maxNumber).fill("");
  
  for (const user of Object.values(users)) {
    const ticketNumbers = user.assignedEditorTickets?.[subject];
    if (ticketNumbers) {
      for (const num of ticketNumbers) {
        if (num <= maxNumber && num > 0) {
          assignments[num - 1] = user.fio;
        }
      }
    }
  }

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === subject);
  if (!sheet?.properties?.sheetId) {
    throw new Error(`Лист "${subject}" не найден в таблице.`);
  }
  const sheetId = sheet.properties.sheetId;

  try {
    const sheetWithMerges = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [subject],
      fields: "sheets(properties.sheetId,merges)",
    });

    const merges = sheetWithMerges.data.sheets?.[0]?.merges || [];
    const unmergeRequests: any[] = [];

    for (const merge of merges) {
      if (
        merge.startColumnIndex === 3 && 
        merge.endColumnIndex === 4 && 
        merge.startRowIndex !== undefined &&
        merge.startRowIndex !== null &&
        merge.endRowIndex !== undefined &&
        merge.endRowIndex !== null &&
        merge.endRowIndex > 7
      ) {
        unmergeRequests.push({
          unmergeCells: {
            range: {
              sheetId: sheetId,
              startRowIndex: merge.startRowIndex,
              endRowIndex: merge.endRowIndex,
              startColumnIndex: merge.startColumnIndex,
              endColumnIndex: merge.endColumnIndex,
            }
          }
        });
      }
    }

    if (unmergeRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: unmergeRequests },
      });
      console.log(`✅ Разъединено ${unmergeRequests.length} диапазонов в колонке D для "${subject}"`);
    }
  } catch (error) {
    const err = error as Error;
    console.warn(`⚠️ Не удалось разъединить ячейки для "${subject}":`, err.message || String(error));
  }

  const mergeRequests: any[] = [];
  const valuesToWrite: string[][] = [];

  let i = 0;
  while (i < assignments.length) {
    if (assignments[i] === "") {
      valuesToWrite.push([""]);
      i++;
      continue;
    }

    const fio = assignments[i];
    let j = i + 1;
    while (j < assignments.length && assignments[j] === fio) {
      j++;
    }

    if (j - i > 1) {
      mergeRequests.push({
        mergeCells: {
          range: {
            sheetId: sheetId,
            startRowIndex: 7 + i,
            endRowIndex: 7 + j,
            startColumnIndex: 3,
            endColumnIndex: 4,
          },
          mergeType: "MERGE_ALL",
        },
      });
    }

    valuesToWrite.push([fio]);
    for (let k = 1; k < (j - i); k++) {
      valuesToWrite.push([""]);
    }

    i = j;
  }

  if (valuesToWrite.length > 0) {
    const range = `${subject}!D8:D${7 + valuesToWrite.length}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "RAW",
      requestBody: { values: valuesToWrite },
    });
    console.log(`✅ Записаны значения редакторов в колонку D для "${subject}"`);
  }

  if (mergeRequests.length > 0) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: mergeRequests },
      });
      console.log(`✅ Объединено ${mergeRequests.length} диапазонов ячеек для "${subject}"`);
    } catch (error) {
      const err = error as Error;
      console.error(`❌ Ошибка при объединении ячеек для "${subject}":`, err.message || String(error));
    }
  }

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${subject}!D7`,
      valueInputOption: "RAW",
      requestBody: { values: [["Редактор"]] },
    });
  } catch (error) {
    const err = error as Error;
    console.warn(`⚠️ Не удалось установить заголовок "Редактор" в D7:`, err.message || String(error));
  }
}

/**
 * Импортирует распределение редакторов из колонки D таблицы и обновляет локальные файлы.
 * Корректно обрабатывает объединённые ячейки (заполняет пропуски значением из предыдущей непустой ячейки).
 * @param {string} subject — название предмета (соответствует имени листа)
 * @returns {Promise<void>}
 */
export async function importEditorAssignmentsFromSheet(subject: string): Promise<void> {
  const cleanSheetName = subject.trim();
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const range = `${cleanSheetName}!D8:D`;
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });

  const rows = response.data.values || [];
  const assignments: Record<number, string> = {};

  let lastFio: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const rawValue = rows[i]?.[0];

    if (rawValue !== undefined && rawValue !== null) {
      const trimmed = rawValue.toString().trim();
      if (trimmed !== "") {
        lastFio = trimmed;
      }
    }

    if (lastFio !== null) {
      assignments[i + 1] = lastFio;
    }
  }

  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const totalTickets = subjectsData[subject]?.length || 0;

  if (lastFio !== null && totalTickets > Object.keys(assignments).length) {
    const currentMax = Object.keys(assignments).length;
    for (let i = currentMax + 1; i <= totalTickets; i++) {
      assignments[i] = lastFio;
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

//  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const updatedSubjectsData = JSON.parse(JSON.stringify(subjectsData)) as AllSubjectsData;
  
  if (!updatedSubjectsData[subject]) {
    throw new Error(`Предмет "${subject}" не найден в subjects_data.json`);
  }

  for (const q of updatedSubjectsData[subject]) {
    q.assignedEditorId = undefined;
  }

  for (const [numStr, fioRaw] of Object.entries(assignments)) {
    const ticketNumber = parseInt(numStr);
    const normalizedFio = fioRaw.toLowerCase().trim();
    const telegramId = fioToId.get(normalizedFio);

    if (telegramId === undefined) {
      console.warn(`⚠️ Редактор "${fioRaw}" не найден для билета №${ticketNumber}`);
      continue;
    }

    const user = updatedUsers[String(telegramId)];
    if (user) {
      if (!user.assignedEditorTickets) user.assignedEditorTickets = {};
      if (!user.assignedEditorTickets[subject]) {
        user.assignedEditorTickets[subject] = [];
      }

      user.assignedEditorTickets[subject].push(ticketNumber);

      user.editor = true;
      if (!user.editorSubjects) user.editorSubjects = [];
      if (!user.editorSubjects.includes(subject)) {
        user.editorSubjects.push(subject);
      }
    }

    const question = updatedSubjectsData[subject].find(q => q.number === ticketNumber);
    if (question) {
      question.assignedEditorId = telegramId;
    }
  }

  for (const user of Object.values(updatedUsers)) {
    const tickets = user.assignedEditorTickets?.[subject];
    if (tickets) tickets.sort((a, b) => a - b);
  }

  await writeJson(USERS_FILE, updatedUsers);
  await writeJson(SUBJECTS_DATA_FILE, updatedSubjectsData);
  
  console.log(`✅ Импортировано распределение редакторов для "${subject}"`);
}

/**
 * Записывает вопросы (билеты) в колонку B листа таблицы из локальных данных.
 * @param {string} subject — название предмета (соответствует имени листа)
 * @returns {Promise<void>}
 */
export async function writeTicketsToSheetForSubject(subject: string): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
  const tickets = subjectsData[subject];

  if (!tickets || tickets.length === 0) {
    throw new Error(`Нет билетов для предмета "${subject}"`);
  }

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === subject);

  if (!sheetExists) {
    throw new Error(`Лист "${subject}" не найден в таблице. Создайте лист с таким названием.`);
  }

  const values = tickets.map(ticket => [ticket.text]);

  const range = `${subject}!B8:B${7 + values.length}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  console.log(`✅ Вопросы для "${subject}" записаны в таблицу (колонка B)`);
}

/**
 * Записывает ВСЕ данные по предмету из локальных файлов в таблицу:
 * - Вопросы в колонку B
 * - Студентов в колонку C
 * - Редакторов в колонку D
 * @param {string} subject — название предмета
 * @returns {Promise<void>}
 */
export async function syncLocalDataToSheet(subject: string): Promise<void> {
  try {
    await writeTicketsToSheetForSubject(subject);
    console.log(`✅ Вопросы для "${subject}" записаны в таблицу (колонка B)`);
  } catch (err) {
    console.error(`❌ Ошибка записи вопросов для "${subject}":`, err);
    throw new Error(`Ошибка записи вопросов: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
  }

  try {
    await writeAssignedUsersToSheetForSubject(subject);
    console.log(`✅ Студенты для "${subject}" записаны в таблицу (колонка C)`);
  } catch (err) {
    console.error(`❌ Ошибка записи студентов для "${subject}":`, err);
    throw new Error(`Ошибка записи студентов: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
  }

  try {
    await writeEditorAssignmentsToSheetForSubject(subject);
    console.log(`✅ Редакторы для "${subject}" записаны в таблицу (колонка D)`);
  } catch (err) {
    console.error(`❌ Ошибка записи редакторов для "${subject}":`, err);
    throw new Error(`Ошибка записи редакторов: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
  }
}

/**
 * Создаёт новый предмет в локальных данных на основе данных из Google Таблицы.
 * Проверяет существование всех ФИ в базе данных перед созданием.
 * Автоматически назначает редакторские права новым редакторам.
 * @param {string} subject - название нового предмета
 * @returns {Promise<string>} Текстовый результат операции
 */
export async function createNewSubjectFromSheet(subject: string): Promise<string> {
  try {
    const tickets = await fetchTicketsFromSheet(subject);

    if (tickets.length === 0) {
      return `❌ Нет билетов для предмета "${subject}" в таблице`;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const studentsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${subject}!C8:C`,
    });
    const studentRows = studentsResponse.data.values || [];
    const studentAssignments: Record<number, string> = {};

    for (let i = 0; i < studentRows.length; i++) {
      const cellValue = studentRows[i]?.[0]?.toString().trim() || "";
      if (cellValue !== "") {
        studentAssignments[i + 1] = cellValue;
      }
    }

    const editorsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${subject}!D8:D`,
    });
    const editorRows = editorsResponse.data.values || [];
    const editorAssignments: Record<number, string> = {};

    let lastEditorFio: string | null = null;
    for (let i = 0; i < editorRows.length; i++) {
      const rawValue = editorRows[i]?.[0];
      if (rawValue !== undefined && rawValue !== null) {
        const trimmed = rawValue.toString().trim();
        if (trimmed !== "") {
          lastEditorFio = trimmed;
        }
      }
      if (lastEditorFio !== null) {
        editorAssignments[i + 1] = lastEditorFio;
      }
    }

    if (lastEditorFio !== null && tickets.length > Object.keys(editorAssignments).length) {
      const currentMax = Object.keys(editorAssignments).length;
      for (let i = currentMax + 1; i <= tickets.length; i++) {
        editorAssignments[i] = lastEditorFio;
      }
    }

    const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
    const existingFios = new Set(Object.values(users).map(u => u.fio.toLowerCase().trim()));

    const allFios = new Set<string>();
    Object.values(studentAssignments).forEach(fio => allFios.add(fio.toLowerCase().trim()));
    Object.values(editorAssignments).forEach(fio => allFios.add(fio.toLowerCase().trim()));

    const missingFios: string[] = [];
    for (const fio of allFios) {
      if (!existingFios.has(fio)) {
        missingFios.push(fio);
      }
    }

    if (missingFios.length > 0) {
      return `❌ Следующие ФИ отсутствуют в базе данных:\n${missingFios.join('\n')}`;
    }

    const newSubjectData = tickets.map(ticket => ({
      ...ticket,
      status: "not_submitted" as const,
      assignedTo: undefined as number | undefined,
      assignedEditorId: undefined as number | undefined
    }));

    const updatedUsers = JSON.parse(JSON.stringify(users)) as Record<string, UserRecord>;
    const fioToId = new Map<string, number>();
    for (const user of Object.values(users)) {
      fioToId.set(user.fio.toLowerCase().trim(), user.telegramId);
    }

    for (const [numStr, fioRaw] of Object.entries(studentAssignments)) {
      const ticketNumber = parseInt(numStr);
      const normalizedFio = fioRaw.toLowerCase().trim();
      const telegramId = fioToId.get(normalizedFio)!;
      
      const user = updatedUsers[String(telegramId)];
      if (user) {
        if (!user.assignedTickets) user.assignedTickets = {};
        if (!user.assignedTickets[subject]) {
          user.assignedTickets[subject] = [];
        }
        user.assignedTickets[subject].push(ticketNumber);

        if (!user.subjects) user.subjects = [];
        if (!user.subjects.includes(subject)) {
          user.subjects.push(subject);
        }
      }

      const question = newSubjectData.find(q => q.number === ticketNumber);
      if (question) {
        question.assignedTo = telegramId;
      }
    }

    for (const [numStr, fioRaw] of Object.entries(editorAssignments)) {
      const ticketNumber = parseInt(numStr);
      const normalizedFio = fioRaw.toLowerCase().trim();
      const telegramId = fioToId.get(normalizedFio)!;
      
      const user = updatedUsers[String(telegramId)];
      if (user) {
        user.editor = true;

        if (!user.editorSubjects) user.editorSubjects = [];
        if (!user.editorSubjects.includes(subject)) {
          user.editorSubjects.push(subject);
        }

        if (!user.assignedEditorTickets) user.assignedEditorTickets = {};
        if (!user.assignedEditorTickets[subject]) {
          user.assignedEditorTickets[subject] = [];
        }
        user.assignedEditorTickets[subject].push(ticketNumber);
      }

      const question = newSubjectData.find(q => q.number === ticketNumber);
      if (question) {
        question.assignedEditorId = telegramId;
      }
    }

    for (const user of Object.values(updatedUsers)) {
      const studentTickets = user.assignedTickets?.[subject];
      if (studentTickets) studentTickets.sort((a, b) => a - b);
      
      const editorTickets = user.assignedEditorTickets?.[subject];
      if (editorTickets) editorTickets.sort((a, b) => a - b);
    }

    const subjectsData = await readJson<AllSubjectsData>(SUBJECTS_DATA_FILE);
    subjectsData[subject] = newSubjectData;
    
    await writeJson(SUBJECTS_DATA_FILE, subjectsData);
    await writeJson(USERS_FILE, updatedUsers);

    const uniqueStudents = new Set(Object.values(studentAssignments)).size; 
    const uniqueEditors = new Set(Object.values(editorAssignments)).size;

    return `✅ Предмет "${subject}" успешно создан!\n\n` +
           `🎫 Билетов: ${tickets.length}\n` +
           `👥 Студентов: ${uniqueStudents} (назначено на ${Object.keys(studentAssignments).length} билетов)\n` +
           `👑 Редакторов: ${uniqueEditors} (назначено на ${Object.keys(editorAssignments).length} билетов)`;
  
  } catch (err) {
    console.error("Ошибка при создании предмета:", err);
    return `❌ Ошибка при создании предмета "${subject}":\n${err instanceof Error ? err.message : 'Неизвестная ошибка'}`;
  }
}