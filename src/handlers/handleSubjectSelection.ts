// src/handlers/handleSubjectSelection.ts
import { MyContext } from "../types.js";
import { keyboardSubjectSelection } from "../keyboards/keyboardSubjectSelection.js";
import { saveUserSubjects } from "../storage/usersStorage.js";

export async function handleSubjectSelection(ctx: MyContext): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;
  if (!callbackData || !ctx.session.user.allSubjects) return;

  const currentSelected = ctx.session.user.selectedSubjects || [];

  if (callbackData.startsWith("toggle_")) {
    const subject = callbackData.slice("toggle_".length);
    const isSelected = currentSelected.includes(subject);
    let newSelected: string[];

    if (isSelected) {
      newSelected = currentSelected.filter(s => s !== subject);
    } else {
      newSelected = [...currentSelected, subject];
    }

    ctx.session.user.selectedSubjects = newSelected;

    // Обновляем клавиатуру
    await ctx.editMessageReplyMarkup({
      reply_markup: {
        inline_keyboard: keyboardSubjectSelection(newSelected, ctx.session.user.allSubjects),
      },
    });

    // Подтверждаем нажатие (убираем "часики")
    await ctx.answerCallbackQuery();
  } else if (callbackData === "subjects_done") {
    const selected = ctx.session.user.selectedSubjects || [];

    await saveUserSubjects(ctx.from!.id, selected);

    await ctx.editMessageText("✅ Выбраны предметы: " + (ctx.session.user.selectedSubjects?.join(", ") || "ни одного" + "\nВы сможете изменить свой выбор в меню /menu"));
    delete ctx.session.user.fio;
    delete ctx.session.user.state;
    delete ctx.session.user.allSubjects;
    delete ctx.session.user.selectedSubjects;
    await ctx.answerCallbackQuery();
  } else if (callbackData === "subjects_cancel") {
    await saveUserSubjects(ctx.from!.id, []);
    await ctx.editMessageText("Выбор предметов отменён. Вы сможете выбрать предметы в меню /menu");
    delete ctx.session.user.fio;
    delete ctx.session.user.state;
    delete ctx.session.user.allSubjects;
    delete ctx.session.user.selectedSubjects;
    await ctx.answerCallbackQuery();
  }
}