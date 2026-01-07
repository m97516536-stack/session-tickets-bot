// src/utils/updatePhase.ts
// Возможно потом переписать под более умную логику для меньшей нагрузки

import { bot } from "../bot.js";
import { updateAllKeyboards } from "./updateKeyboards.js";
import { distributeTickets } from "./distributeTickets.js";

import { PhaseConfig } from "../types.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { PHASE_CONFIG_FILE } from "../config.js";

export function updateCurrentPhase(config: PhaseConfig): void {
  const now = new Date();

  if (!config.deadlines) {
    config.currentPhase = "preparation";
    return;
  }

  const regEnd = new Date(config.deadlines.registrationEnd);
  const editEnd = new Date(config.deadlines.editingEnd);
  const tickEnd = new Date(config.deadlines.ticketingEnd);

  regEnd.setHours(23, 0, 0, 0);
  editEnd.setHours(23, 0, 0, 0);
  tickEnd.setHours(23, 0, 0, 0);

  if (now < regEnd) {
    config.currentPhase = "registration";
  } else if (now < editEnd) {
    config.currentPhase = "editing";
  } else if (now < tickEnd) {
    config.currentPhase = "ticketing";
  } else {
    config.currentPhase = "finished";
  }
}

async function updatePhaseAndWriteIfChanged(): Promise<PhaseConfig["currentPhase"]> {
  let config = await readJson<PhaseConfig>(PHASE_CONFIG_FILE);

  const oldPhase = config.currentPhase;

  updateCurrentPhase(config);

  if (oldPhase !== config.currentPhase) {
    if (oldPhase === "registration" && config.currentPhase === "editing") {
      try {
        console.log("🎯 Запуск автоматического распределения билетов...");
        await distributeTickets();
        console.log("✅ Распределение билетов успешно завершено!");
      } catch (error) {
        console.error("❌ КРИТИЧЕСКАЯ ОШИБКА при распределении билетов:", error);

        config.currentPhase = oldPhase;
        console.log(`⚠️ Фаза сохранена как "${oldPhase}" из-за ошибки распределения`);

        await writeJson(PHASE_CONFIG_FILE, config);

        return config.currentPhase;
      }
    }

    await writeJson(PHASE_CONFIG_FILE, config);
    console.log(`🔄 Фаза изменена с "${oldPhase}" на "${config.currentPhase}"`);

    await updateAllKeyboards(bot, config.currentPhase);
  }

  if (oldPhase !== config.currentPhase) {
    await writeJson(PHASE_CONFIG_FILE, config);
    console.log(`🔄 Фаза изменена с "${oldPhase}" на "${config.currentPhase}"`);
  }

  return config.currentPhase;
}

export async function startPhaseUpdater(): Promise<void> {
  setInterval(async () => {
    await updatePhaseAndWriteIfChanged();
  }, 60 * 1000);
}

export async function fastCheckPhase(): Promise<PhaseConfig["currentPhase"]> {
  try {
    return await updatePhaseAndWriteIfChanged();
  } catch (error) {
    console.error("❌ Ошибка при проверке фазы:", error);
    return undefined;
  }
}