// src/utils/updatePhase.ts

import { AdminSession, MySession } from "../types.js";
import { readJson, writeJson } from "../storage/jsonStorage.js";
import { SESSIONS_FILE, ADMIN_ID } from "../config.js";

export function updateCurrentPhase(adminSession: AdminSession): void {
  const now = new Date();

  if (!adminSession.deadlines) {
    adminSession.currentPhase = undefined;
    return;
  }

  const regEnd = new Date(adminSession.deadlines.registrationEnd);
  const editEnd = new Date(adminSession.deadlines.editingEnd);
  const prepEnd = new Date(adminSession.deadlines.preparationEnd);

  regEnd.setHours(23, 0, 0, 0);
  editEnd.setHours(23, 0, 0, 0);
  prepEnd.setHours(23, 0, 0, 0);

  if (now < regEnd) {
    adminSession.currentPhase = "registration";
  } else if (now < editEnd) {
    adminSession.currentPhase = "editing";
  } else if (now < prepEnd) {
    adminSession.currentPhase = "preparation";
  } else {
    adminSession.currentPhase = "finished";
  }
}

export async function startPhaseUpdater(): Promise<void> {
  let sessions = await readJson<Record<string, MySession>>(SESSIONS_FILE);

  setInterval(async () => {
    const adminSession = sessions[ADMIN_ID]?.admin;
    if (!adminSession) return;

    const oldPhase = adminSession.currentPhase;

    updateCurrentPhase(adminSession);

    // Сохраняем, если этап изменился
    if (oldPhase !== adminSession.currentPhase) {
      await writeJson(SESSIONS_FILE, sessions);
    }
  }, 60 * 1000);
}