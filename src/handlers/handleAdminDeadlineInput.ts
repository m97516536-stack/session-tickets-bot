// handlers/handleAdminDeadlineInput.ts
import { MyContext } from "../types.js";
import { commandAdmin } from "../commands/admin.js";

function isValidDateStr(str: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(str)) return false;
  const d = new Date(str);
  return d instanceof Date && !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

export async function handleAdminDeadlineInput(ctx: MyContext): Promise<void> {
  const input = ctx.msg?.text?.trim();

  if (!input || !isValidDateStr(input)) {
    // Обновим панель с ошибкой или инструкцией
    const adminSession = ctx.session.admin;
    if (adminSession?.state === "awaiting_deadline_start") {
      await ctx.reply("❌ Неверный формат. Пожалуйста, введите дату в формате ГГГГ-ММ-ДД:");
      return;
    }
  }

  const baseDate = new Date(input + "T23:00:00");

  const addDays = (date: Date, days: number) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy.toISOString();
  };

  const deadlines = {
    registrationEnd: addDays(baseDate, 0),
    phase1End: addDays(baseDate, 7),
    phase2End: addDays(baseDate, 14),
    phase3End: addDays(baseDate, 21),
  };

  // Обновляем сессию
  ctx.session.admin = {
    ...ctx.session.admin,
    state: "in_deadline_cycle",
    deadlines,
  };

  // Обновляем сообщение с клавиатурой и текстом
  await commandAdmin(ctx);
}