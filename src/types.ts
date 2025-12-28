import { SessionFlavor, Context } from "grammy";

export interface UserRecord {
  telegramId: number;
  fio: string;
  registeredAt: string;
  subjects?: string[];
  assignedTickets?: Record<string, { number: number; text: string }[]>;
}

export interface UserSession {
  state?: "awaiting_fio" | "awaiting_subject_selection" | "awaiting_subject_and_sheet";
  fio?: string;
  awaitingSubjectId?: number;
  allSubjects?: string[];
  selectedSubjects?: string[];
}

export interface AdminSession {
  state?: "awaiting_deadline_start" | "in_deadline_cycle";
  deadlines?: {
    registrationEnd: string;
    phase1End: string;
    phase2End: string;
    phase3End: string;
  };
  lastAdminMessageId?: number;
}

export type SubjectConfig = Record<string, {
  subjectAndSheetName: string;
}>;

export type TicketsBySubject = Record<string, {
  number: number;
  text: string;
}[]>;

export type MyContext = Context & SessionFlavor<{ user: UserSession, admin?: AdminSession }>;