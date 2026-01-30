// src/types.ts

import { SessionFlavor, Context } from "grammy";

/**
 * Типы данных, используемые в боте.
 * 
 * @description
 * Определяет интерфейсы и типы для:
 * - сессий пользователей (user, admin, editor)
 * - контекста бота с поддержкой сессий
 * - структуры билетов, предметов, пользователей и фаз системы
 */

export interface UserSession {
  state?: "awaiting_fio"
    | "awaiting_subject_selection"
    | "awaiting_subject_and_sheet";
  fio?: string;
  awaitingSubjectId?: number;
  allSubjects?: string[];
  selectedSubjects?: string[];
  awaitingTicketSubmission?: {
    subject: string;
    ticketNumber: number;
  };
}

export interface EditorSession {
  awaitingRevisionComment?: { subject: string; ticketNumber: number };
  awaitingReplacementFile?: { subject: string; ticketNumber: number };
  chatId?: number;
  messageIdToDelete?: number;
  promptMessageId?: number;
}

export interface AdminSession {
  state?: "awaiting_subject_name"
    | "setting_deadlines"
    | "awaiting_registration_end_date"
    | "awaiting_editing_end_date"
    | "awaiting_ticketing_end_date";
  awaitingSubjectThreadId?: number;
  downloadMode?: "with_redistribution" | "without_redistribution";
  deadlines?: {
    registrationEnd: string;
    editingEnd: string;
    ticketingEnd: string;
  }
}

export type MySession = {
  user: UserSession;
  admin: AdminSession;
  editor: EditorSession;
};

export type MyContext = Context & SessionFlavor<MySession>;


export type Question = {
  number: number;
  text: string;
  assignedTo?: number;
  status?: "not_submitted" | "pending" | "approved" | "revision";
  fileId?: string;
  comment?: string;
  editorComment?: string;
  fileVersion?: number;
  fileExtension?: string;
  messageId?: number;
};

export type SubjectData = {
  chatId: string;
  questions: Question[];
};

export type AllSubjectsData = Record<string, SubjectData>;

export interface UserRecord {
  telegramId: number;
  fio: string;
  registeredAt: string;
  subjects?: string[];
  assignedTickets?: Record<string, number[]>;
};


export interface PhaseConfig {
  deadlines?: {
    registrationEnd: string;
    editingEnd: string;
    ticketingEnd: string;
  };
  currentPhase?: "preparation" | "registration" | "editing" | "ticketing" | "finished";
}