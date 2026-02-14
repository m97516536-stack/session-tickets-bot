// src/keyboards/keyboardAdminTicketing.ts

import { InlineKeyboard } from "grammy";
import { readJson } from "../storage/jsonStorage.js";
import { USERS_FILE, SUBJECTS_DATA_FILE } from "../config.js";
import { UserRecord } from "../types.js";

/**
 * Основная клавиатура админа на этапе ticketing.
 * @param isFinished - true если этап "finished"
 * @returns клавиатура
 */
export function adminKeyboard_Ticketing(isFinished: boolean = false): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("📥 Получить билеты", "admin_download_tickets")
    .row()
    .text("📢 Спам сообщение", "admin_spam")
    .row()
    .text("📊 Статистика", "admin_stats")
    .row()
    .text("🔄 Загрузить из таблицы", "admin_load_from_sheet");
  
  if (isFinished) {
    kb.row().text("🏁 Конец сессии", "admin_end_session");
  }
  
  return kb;
}

/**
 * Клавиатура выбора типа рассылки.
 * @returns клавиатура
 */
export function adminKeyboard_SpamType(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👥 Всем", "spam_all")
    .row()
    .text("👤 По ФИ", "spam_by_fio")
    .row()
    .text("📚 По предмету", "spam_by_subject")
    .row()
    .text("❌ Отмена", "admin_cancel");
}

/**
 * Клавиатура выбора типа статистики.
 * @returns клавиатура
 */
export function adminKeyboard_StatsType(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📚 По предмету", "stats_by_subject")
    .row()
    .text("📋 Общая", "stats_overall")
    .row()
    .text("❌ Отмена", "admin_cancel");
}

/**
 * Клавиатура выбора режима загрузки из таблицы.
 * @returns клавиатура
 */
export function adminKeyboard_LoadModeSelection(): InlineKeyboard {
  return new InlineKeyboard()
    .text("👥 Пользователи", "load_users_mode")
    .row()
    .text("👑 Редакторы", "load_editors_mode")
    .row()
    .text("🔄 Добавить новый предмет", "load_new_subject")
    .row()
    .text("🗑️ Удалить предмет", "delete_subject")
    .row()
    .text("📤 Записать в таблицу", "upload_to_sheet")
    .row()
    .text("❌ Отмена", "admin_cancel");
}

// === СПЕЦИАЛИЗИРОВАННЫЕ КЛАВИАТУРЫ ВЫБОРА ПРЕДМЕТА ===

/**
 * Клавиатура выбора предмета для скачивания билетов админом.
 * Префикс коллбэка: `download_tickets_{subject}`
 * @param subjects - массив названий предметов
 * @returns клавиатура
 */
export function adminKeyboard_SelectSubjectForDownloadTickets(subjects: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  
  for (let i = 0; i < subjects.length; i += 2) {
    const row = subjects.slice(i, i + 2);
    for (const subject of row) {
      kb.text(subject, `download_tickets_${subject}`);
    }
    kb.row();
  }
  
  kb.text("❌ Отмена", "admin_cancel");
  
  return kb;
}

/**
 * Клавиатура выбора предмета для статистики.
 * Префикс коллбэка: `stats_subject_{subject}`
 * @param subjects - массив названий предметов
 * @returns клавиатура
 */
export function adminKeyboard_SelectSubjectForStats(subjects: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  
  for (let i = 0; i < subjects.length; i += 2) {
    const row = subjects.slice(i, i + 2);
    for (const subject of row) {
      kb.text(subject, `stats_subject_${subject}`);
    }
    kb.row();
  }
  
  kb.text("❌ Отмена", "admin_cancel");
  
  return kb;
}

/**
 * Клавиатура выбора предмета для загрузки пользователей из таблицы.
 * Префикс коллбэка: `load_users_{subject}`
 * @param subjects - массив названий предметов
 * @returns клавиатура
 */
export function adminKeyboard_SelectSubjectForLoadUsers(subjects: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  
  for (let i = 0; i < subjects.length; i += 2) {
    const row = subjects.slice(i, i + 2);
    for (const subject of row) {
      kb.text(subject, `load_users_${subject}`);
    }
    kb.row();
  }
  
  kb.text("❌ Отмена", "admin_cancel");
  
  return kb;
}

/**
 * Клавиатура выбора предмета для загрузки редакторов из таблицы.
 * Префикс коллбэка: `load_editors_{subject}`
 * @param subjects - массив названий предметов
 * @returns клавиатура
 */
export function adminKeyboard_SelectSubjectForLoadEditors(subjects: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  
  for (let i = 0; i < subjects.length; i += 2) {
    const row = subjects.slice(i, i + 2);
    for (const subject of row) {
      kb.text(subject, `load_editors_${subject}`);
    }
    kb.row();
  }
  
  kb.text("❌ Отмена", "admin_cancel");
  
  return kb;
}

/**
 * Клавиатура выбора предмета для спам-рассылки.
 * Префикс коллбэка: `spam_subject_{subject}`
 * @param subjects - массив названий предметов
 * @returns клавиатура
 */
export function adminKeyboard_SelectSubjectForSpam(subjects: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  
  for (let i = 0; i < subjects.length; i += 2) {
    const row = subjects.slice(i, i + 2);
    for (const subject of row) {
      kb.text(subject, `spam_subject_${subject}`);
    }
    kb.row();
  }
  
  kb.text("❌ Отмена", "admin_cancel");
  
  return kb;
}

/**
 * Клавиатура выбора предмета для его удаления.
 * Префикс коллбэка: `delete_subject_{subject}`
 * @param subjects - массив названий предметов
 * @returns клавиатура
 */
export function adminKeyboard_SelectSubjectForDelete(subjects: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  
  for (let i = 0; i < subjects.length; i += 2) {
    const row = subjects.slice(i, i + 2);
    for (const subject of row) {
      kb.text(subject, `delete_subject_${subject}`);
    }
    kb.row();
  }
  
  kb.text("❌ Отмена", "admin_cancel");
  
  return kb;
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

/**
 * Текст со списком всех пользователей (для рассылки по ФИ).
 * @returns текстовое сообщение
 */
export async function getUsersListText(): Promise<string> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const userList = Object.values(users);
  
  if (userList.length === 0) {
    return "📋 Список пользователей пуст.";
  }
  
  let text = "📋 Список всех пользователей:\n\n";
  
  userList.sort((a, b) => a.fio.localeCompare(b.fio)).forEach((user, index) => {
    const subjects = user.subjects?.length ? ` [${user.subjects.join(', ')}]` : '';
    const editor = user.editor ? '- 👑' : '';
    text += `${index + 1}. ${user.fio} ${subjects}${editor}\n`;
  });
  
  text += `\nВведите ФИ пользователя (или несколько через запятую) для рассылки:`;
  
  return text;
}

/**
 * Текст общей статистики по всем предметам.
 * @returns текстовое сообщение
 */
export async function getOverallStatsText(): Promise<string> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const subjectsData = await readJson<Record<string, unknown>>(SUBJECTS_DATA_FILE);

  const allUsers = Object.values(users);
  const allSubjects = Object.keys(subjectsData).filter(key => 
    Array.isArray(subjectsData[key]) && (subjectsData[key] as unknown[]).length > 0
  );

  const studentsBySubject: Record<string, number> = {};
  for (const subject of allSubjects) {
    studentsBySubject[subject] = allUsers.filter(u => 
      u.subjects?.includes(subject)
    ).length;
  }

  const editorsCount = allUsers.filter(u => u.editor).length;

  const ticketsBySubject: Record<string, number> = {};
  for (const [subject, questions] of Object.entries(subjectsData)) {
    if (Array.isArray(questions)) {
      ticketsBySubject[subject] = questions.length;
    }
  }

  let text = "📊 Общая статистика:\n\n";

  text += `👥 Всего пользователей: ${allUsers.length}\n`;
  text += `👑 Редакторов: ${editorsCount}\n`;
  text += `📚 Предметов: ${allSubjects.length}\n\n`;

  text += `📋 Билетов по предметам:\n`;
  for (const subject of allSubjects) {
    const tickets = ticketsBySubject[subject] || 0;
    const students = studentsBySubject[subject] || 0;
    text += `  • ${subject}: ${tickets} билетов, ${students} студентов\n`;
  }

  return text;
}

/**
 * Текст статистики по конкретному предмету.
 * @param subject - название предмета
 * @returns текстовое сообщение
 */
export async function getSubjectStatsText(subject: string): Promise<string> {
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const subjectsData = await readJson<Record<string, unknown>>(SUBJECTS_DATA_FILE);
  
  const subjectData = subjectsData[subject];
  if (!subjectData || !Array.isArray(subjectData)) {
    return `❌ Предмет "${subject}" не найден.`;
  }
  
  const allUsers = Object.values(users);

  const students = allUsers.filter(u => u.subjects?.includes(subject));

  const editors = allUsers.filter(u => 
    u.editor && u.editorSubjects?.includes(subject)
  );

  const tickets = subjectData.length;
  const pending = subjectData.filter((q: any) => q.status === "pending").length;
  const approved = subjectData.filter((q: any) => q.status === "approved").length;
  const revision = subjectData.filter((q: any) => q.status === "revision").length;
  const notSubmitted = subjectData.filter((q: any) => 
    !q.status || q.status === "not_submitted"
  ).length;
  
  let text = `📊 Статистика по предмету "${subject}":\n\n`;
  
  text += `🎫 Всего билетов: ${tickets}\n`;
  text += `✅ Принято: ${approved}\n`;
  text += `⏳ На проверке: ${pending}\n`;
  text += `🔄 На доработке: ${revision}\n`;
  text += `📝 Не отправлено: ${notSubmitted}\n\n`;
  
  text += `👥 Студентов: ${students.length}\n`;
  if (students.length > 0) {
    text += students.map((u, i) => `  ${i + 1}. ${u.fio}`).join('\n');
  }
  
  text += `\n\n👑 Редакторов: ${editors.length}\n`;
  if (editors.length > 0) {
    text += editors.map((u, i) => `  ${i + 1}. ${u.fio}`).join('\n');
  }
  
  return text;
}

/**
 * Клавиатура отмены (для ввода сообщения рассылки).
 * @returns клавиатура
 */
export function adminKeyboard_CancelSpam(): InlineKeyboard {
  return new InlineKeyboard()
    .text("❌ Отмена", "admin_cancel");
}