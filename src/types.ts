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
    | "awaiting_subject_and_sheet"
    | "awaiting_editor_subject_selection";
  fio?: string;
  awaitingSubjectId?: number;
  allSubjects?: string[];
  selectedSubjects?: string[];
  selectedEditorSubjects?: string[];
  awaitingTicketSubmission?: {
    subject: string;
    ticketNumber: number;
  };
}

export interface EditorSession {
  awaitingRevisionComment?: {
    subject: string;
    ticketNumber: number;
  };
  awaitingReplacementFile?: {
    subject: string;
    ticketNumber: number;
  };
  chatId?: number;
  promptMessageId?: number;
}

export interface AdminSession {
  state?: "awaiting_subject_name"
    | "setting_deadlines"
    | "awaiting_registration_end_date"
    | "awaiting_editing_end_date"
    | "awaiting_ticketing_end_date"
    | "awaiting_editor_fio"
    | "awaiting_remove_editor_fio"
    | "awaiting_new_subject_name";
    awaitingSubject?: string;
  awaitingSubjectThreadId?: number;
  downloadMode?: "with_redistribution" | "without_redistribution";
  deadlines?: {
    registrationEnd: string;
    editingEnd: string;
    ticketingEnd: string;
  }
  spam?: {
    type: "spam_by_fio"
    | "spam_by_subject"
    | "spam_all";
    userIds?: number[];
    subject?: string;
    files?: string[];
    text?: string;
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
  comment?: string;
  fileVersion?: number;
  fileExtension?: string;
  assignedEditorId?: number;
  editorComment?: string;
};

export type AllSubjectsData = Record<string, Question[]>;

export interface UserRecord {
  telegramId: number;
  fio: string;
  registeredAt: string;
  subjects?: string[];
  assignedTickets?: Record<string, number[]>;
  editor?: boolean;
  editorSubjects?: string[];
  assignedEditorTickets?: Record<string, number[]>;
};


export interface PhaseConfig {
  deadlines?: {
    registrationEnd: string;
    editingEnd: string;
    ticketingEnd: string;
  };
  currentPhase?: "preparation" | "registration" | "editing" | "ticketing" | "finished";
}


export interface EditorRequest {
  telegramId: number;
  name: string;
  subjects: string[];
}

export type EditorRequests = EditorRequest[];