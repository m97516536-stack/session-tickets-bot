// src/types.ts

import { SessionFlavor, Context } from "grammy";

export interface UserSession {
  state?: "awaiting_fio"
    | "awaiting_subject_selection"
    | "awaiting_subject_and_sheet";
  fio?: string;
  awaitingSubjectId?: number;
  allSubjects?: string[];
  selectedSubjects?: string[];
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
};

export type MyContext = Context & SessionFlavor<MySession>;


export type Question = {
  number: number;
  text: string;
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
  assignedTickets?: Record<string, { number: number; text: string }[]>;
};


export interface PhaseConfig {
  deadlines?: {
    registrationEnd: string;
    editingEnd: string;
    ticketingEnd: string;
  };
  currentPhase?: "preparation" | "registration" | "editing" | "ticketing" | "finished";
}