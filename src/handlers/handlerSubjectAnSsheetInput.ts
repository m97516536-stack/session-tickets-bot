import { MyContext, SubjectConfig, TicketsBySubject } from "../types.js";
import { ADMIN_ID, SUBJECT_CONFIG_FILE, TICKETS_FILE } from "../config.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { fetchTicketsFromSheet } from "../storage/googleSheets.js";

export async function handlerSubjectAnSsheetInput(ctx: MyContext): Promise<void> {
  if (ctx.from?. id !== ADMIN_ID) return;
  if (ctx.chat?.type !== "supergroup") return;

  const threadId = ctx.session.user.awaitingSubjectId;
  if (!threadId) {
    await ctx.reply("❌ Состояние повреждено. Повторите /init.");
    delete ctx.session.user.state;
    return;
  }

  const subjectAndSheetName = ctx.msg?.text?.trim();
  if (!subjectAndSheetName) {
    await ctx.reply("❌ Вы не ввели данные. Повторите ввод.");
    return;
  }

  const subjectConfig = await readJson<SubjectConfig>(SUBJECT_CONFIG_FILE);
  subjectConfig[threadId] = { subjectAndSheetName };
  await writeJson(SUBJECT_CONFIG_FILE, subjectConfig);

  const loadingMsg = await ctx.reply(`⏳ Загружаю билеты по предмету "${subjectAndSheetName}"...`);

  let tickets;
  try {
    tickets = await fetchTicketsFromSheet(subjectAndSheetName);
    if (tickets.length === 0) {
      throw new Error("Нет билетов на листе");
    }
  } catch (err) {
    console.error("Ошибка загрузки билетов:", err);
    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      `❌ Не удалось загрузить билеты. Проверьте:\n1. Название листа в таблице\n2. Доступ у сервисного аккаунта\n3. Наличие данных в столбце B (начиная с 8-й строки)`
    );
    return;
  }

  const allTickets = await readJson<TicketsBySubject>(TICKETS_FILE);
  allTickets[subjectAndSheetName] = tickets;
  await writeJson(TICKETS_FILE, allTickets);

  await ctx.api.editMessageText(
    ctx.chat.id,
    loadingMsg.message_id,
    `✅ Предмет "${subjectAndSheetName}" инициализирован!\n📥 Загружено ${tickets.length} билетов.`
  );

  delete ctx.session.user.state;
  delete ctx.session.user.awaitingSubjectId;

  return;
}