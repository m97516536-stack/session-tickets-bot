// src/handlers/callbackHandlers/handleUserTicketingCallback.ts

import { InlineKeyboard } from "grammy";
import { MyContext, UserRecord } from "../../types.js";
import { manageKeyboard } from "../../utils/manageKeyboard.js";
import { keyboardSubmitTicket, userKeyboard_Ticketing, getUserTicketsText } from "../../keyboards/keyboardUserTicketing.js";
import { readJson } from "../../storage/jsonStorage.js";
import { USERS_FILE } from "../../config.js";

/**
 * Обрабатывает действия пользователя на этапе отправки решений билетов.
 * @param {MyContext} ctx - контекст бота
 * @returns {Promise<void>}
 */
export async function handleUserTicketingCallback(ctx: MyContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (!ctx.from) {
    await ctx.answerCallbackQuery("❌ Пользователь не определён.");
    return;
  }

  const userId = String(ctx.from.id);
  const users = await readJson<Record<string, UserRecord>>(USERS_FILE);
  const user = users[userId];

  if (!user) {
    await ctx.answerCallbackQuery("❌ Пользователь не найден.");
    return;
  }

  if (data === "submit_ticket") {
    await ctx.answerCallbackQuery();

    const keyboard = await keyboardSubmitTicket(user);
    const text = await getUserTicketsText(user);
    await manageKeyboard(
      ctx,
      text + "\n\nВыберите билет для отправки:",
      keyboard,
      "user",
      false
    );
    return;
  }

  if (data?.startsWith("submit_ticket_") && data !== "submit_ticket") {
    await ctx.answerCallbackQuery();

    const parts = data.split("_");
    if (parts.length < 4) {
      await ctx.reply("❌ Некорректный формат выбора билета.");
      return;
    }

    const subject = parts.slice(2, -1).join("_");
    const ticketNumberStr = parts[parts.length - 1];
    const ticketNumber = parseInt(ticketNumberStr, 10);

    if (isNaN(ticketNumber)) {
      await ctx.reply("❌ Неверный номер билета.");
      return;
    }

    const assigned = user.assignedTickets?.[subject] || [];
    if (!assigned.includes(ticketNumber)) {
      await ctx.reply("❌ У вас нет такого билета.");
      return;
    }

    ctx.session.user.awaitingTicketSubmission = { subject, ticketNumber };

    const keyboard = new InlineKeyboard().text("🔙 Назад", "back_to_ticketing_menu");

    await manageKeyboard(
      ctx,
      "📄 Отправьте файл с решением.\nМожно добавить комментарий в подпись к файлу.",
      keyboard,
      "user",
      true
    );
    return;
  }

  if (data === "back_to_ticketing_menu") {
    await ctx.answerCallbackQuery();

    const text = await getUserTicketsText(user);
    await manageKeyboard(
      ctx,
      text,
      userKeyboard_Ticketing(),
      "user",
      false
    );
    return;
  }

  if (data === "noop") {
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery({
    text: "❌ Неизвестная команда.",
    show_alert: true
  });
}