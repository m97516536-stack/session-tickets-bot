// keyboards/keyboardAdmin.ts
import { InlineKeyboard } from "grammy";
import { MyContext } from "../types.js";

export function buildAdminKeyboard(ctx: MyContext): InlineKeyboard {
  const kb = new InlineKeyboard();

  const adminSession = ctx.session.admin;
  const now = new Date();

  let hasActiveDeadlines = false;
  if (adminSession?.deadlines) {
    const { registrationEnd, phase3End } = adminSession.deadlines;
    const regEnd = new Date(registrationEnd);
    const lastDeadline = new Date(phase3End);
    if (now < lastDeadline) {
      hasActiveDeadlines = true;
    }
  }

  if (!hasActiveDeadlines && adminSession?.state !== "awaiting_deadline_start") {
    kb.text("🆕 Начать новый набор", "admin:new_cycle");
  } else if (adminSession?.state === "awaiting_deadline_start") {
    kb.text("⏳ Введите дату", "admin:awaiting_date"); // можно оставить, но необязательно
  } else {
    kb.text("📅 Просмотр дедлайнов", "admin:view_deadlines");
  }

  return kb;
}

export function buildAdminText(ctx: MyContext): string {
  const adminSession = ctx.session.admin;

  let text = "🛠️ Панель администратора\n\n";

  if (adminSession?.state === "awaiting_deadline_start") {
    text += "⏰ Ожидание даты окончания регистрации...\n";
    text += "\nВведите дату в формате ГГГГ-ММ-ДД:";
  } else if (adminSession?.deadlines) {
    const { registrationEnd, phase1End, phase2End, phase3End } = adminSession.deadlines;
    const now = new Date();

    const format = (d: string) => new Date(d).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });

    text += `📅 Регистрация до: ${format(registrationEnd)}\n`;
    text += `✅ Дедлайн 1: ${format(phase1End)}\n`;
    text += `✅ Дедлайн 2: ${format(phase2End)}\n`;
    text += `✅ Дедлайн 3: ${format(phase3End)}\n\n`;

    const lastDeadline = new Date(phase3End);
    if (now > lastDeadline) {
      text += "🟢 Все дедлайны прошли.\n";
    } else if (now > new Date(phase2End)) {
      text += "🟡 Третий дедлайн активен.\n";
    } else if (now > new Date(phase1End)) {
      text += "🟡 Второй дедлайн активен.\n";
    } else if (now > new Date(registrationEnd)) {
      text += "🟡 Первый дедлайн активен.\n";
    } else {
      text += "🟡 Регистрация активна.\n";
    }
  } else {
    text += "📅 Нет активных дедлайнов.\n";
  }

  return text;
}


/*

  1) Начать новый набор (Они меняються поочереди, потом  прикрутим)
  3) Спам сообщение всем / определённой группе по предмету и редакторам
  4) Дисквалифицировать участника
  5) Список участников (по предмету / все учасники)
  6) Все готовые билеты по предмету
  7) Назначение редакторов (дос)

*/