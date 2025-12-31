// src/utils/adminText.ts

import { AdminSession } from "../types.js";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

export function getDeadlinesText(adminSession: AdminSession): string {
  const deadlines = adminSession.deadlines;
  return (
    "📅 Установите даты окончания этапов:\n\n" +
    `1. Регистрация: ${deadlines?.registrationEnd ? formatDate(deadlines.registrationEnd) : "не установлена"}\n` +
    `2. Редактирование: ${deadlines?.editingEnd ? formatDate(deadlines.editingEnd) : "не установлена"}\n` +
    `3. Подготовка: ${deadlines?.preparationEnd ? formatDate(deadlines.preparationEnd) : "не установлена"}\n\n` +
    "Нажмите на кнопку, чтобы установить дату."
  );
}