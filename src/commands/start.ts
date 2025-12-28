import { MyContext } from "../types.js";

export async function commandStart(ctx: MyContext): Promise<void> {
  if (ctx.chat?.type !== "private") return;
  if (ctx.session.user.fio) {
    await ctx.reply(`Привет, ${ctx.session.user.fio}!`);
    return;
  }

  await ctx.reply("👋 Привет! Введите вашу Фамилию и Имя (ФИ):");
  console.log(ctx.from?.id);
  ctx.session.user.state = "awaiting_fio";
}