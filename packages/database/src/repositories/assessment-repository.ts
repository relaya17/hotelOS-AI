import { and, desc, eq, isNull, or } from "drizzle-orm";
import type { TenantId, UserId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import {
  assessmentAssignments,
  assessmentResults,
  assessmentTemplates,
} from "../schema/hr.js";

export type AssessmentQuestion = {
  readonly id: string;
  readonly promptHe: string;
  readonly options: readonly { readonly id: string; readonly labelHe: string }[];
  readonly correctOptionId: string;
};

export type PersistedAssessmentTemplate = {
  readonly id: string;
  readonly tenantId: string | null;
  readonly titleHe: string;
  readonly titleEn: string;
  readonly category: string;
  readonly passingScore: number;
  readonly questions: readonly AssessmentQuestion[];
  readonly createdAt: string;
};

export type PersistedAssessmentAssignment = {
  readonly id: string;
  readonly tenantId: string;
  readonly employeeId: string;
  readonly templateId: string;
  readonly status: string;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly titleHe?: string;
};

const GLOBAL_TEMPLATES: readonly {
  readonly id: string;
  readonly titleHe: string;
  readonly titleEn: string;
  readonly category: string;
  readonly passingScore: number;
  readonly questions: readonly AssessmentQuestion[];
}[] = [
  {
    id: "tmpl-service-basics",
    titleHe: "שירותיות בסיסית",
    titleEn: "Hospitality service basics",
    category: "service",
    passingScore: 70,
    questions: [
      {
        id: "q1",
        promptHe: "אורח מתלונן על רעש בחדר. מה הצעד הראשון?",
        options: [
          { id: "a", labelHe: "להתעלם אם זה אחרי חצות" },
          { id: "b", labelHe: "להקשיב, להתנצל, ולהציע פתרון מיידי" },
          { id: "c", labelHe: "להפנות רק למייל" },
        ],
        correctOptionId: "b",
      },
      {
        id: "q2",
        promptHe: "מתי מומלץ להציע upsell?",
        options: [
          { id: "a", labelHe: "רק בלחץ מהמנהל" },
          { id: "b", labelHe: "כשיש ערך ברור לאורח ובלי לחץ" },
          { id: "c", labelHe: "לעולם לא" },
        ],
        correctOptionId: "b",
      },
    ],
  },
  {
    id: "tmpl-hk-safety",
    titleHe: "בטיחות משק בית",
    titleEn: "Housekeeping safety",
    category: "role_knowledge",
    passingScore: 80,
    questions: [
      {
        id: "q1",
        promptHe: "נמצא חפץ חשוד בחדר. מה לעשות?",
        options: [
          { id: "a", labelHe: "לפתוח ולבדוק" },
          { id: "b", labelHe: "לצאת, לדווח לאבטחה/קבלה, לא לגעת" },
          { id: "c", labelHe: "לזרוק לפח" },
        ],
        correctOptionId: "b",
      },
    ],
  },
];

function mapTemplate(
  row: typeof assessmentTemplates.$inferSelect,
): PersistedAssessmentTemplate {
  const questionsUnknown: unknown = JSON.parse(row.questionsJson);
  return {
    id: row.id,
    tenantId: row.tenantId ?? null,
    titleHe: row.titleHe,
    titleEn: row.titleEn,
    category: row.category,
    passingScore: Number(row.passingScore),
    questions: questionsUnknown as AssessmentQuestion[],
    createdAt: row.createdAt,
  };
}

export type AssessmentRepository = {
  ensureGlobalTemplates: () => Promise<void>;
  listTemplates: (tenantId: TenantId) => Promise<readonly PersistedAssessmentTemplate[]>;
  assign: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly employeeId: string;
    readonly templateId: string;
    readonly assignedByUserId: UserId;
    readonly dueAt?: string;
    readonly createdAt: string;
  }) => Promise<PersistedAssessmentAssignment>;
  listByEmployee: (
    tenantId: TenantId,
    employeeId: string,
  ) => Promise<readonly PersistedAssessmentAssignment[]>;
  getAssignment: (
    tenantId: TenantId,
    assignmentId: string,
  ) => Promise<
    | (PersistedAssessmentAssignment & {
        readonly questions: readonly Omit<AssessmentQuestion, "correctOptionId">[];
        readonly passingScore: number;
      })
    | null
  >;
  submit: (input: {
    readonly tenantId: TenantId;
    readonly assignmentId: string;
    readonly answers: Readonly<Record<string, string>>;
    readonly completedAt: string;
  }) => Promise<
    | {
        readonly ok: true;
        readonly score: number;
        readonly passed: boolean;
      }
    | { readonly ok: false; readonly reason: "NOT_FOUND" | "ALREADY_DONE" }
  >;
};

export function createAssessmentRepository(db: HotelOsDb): AssessmentRepository {
  return {
    async ensureGlobalTemplates() {
      const now = new Date().toISOString();
      for (const tmpl of GLOBAL_TEMPLATES) {
        const existing = await db
          .select()
          .from(assessmentTemplates)
          .where(eq(assessmentTemplates.id, tmpl.id))
          .get();
        if (existing) continue;
        await db
          .insert(assessmentTemplates)
          .values({
            id: tmpl.id,
            tenantId: null,
            titleHe: tmpl.titleHe,
            titleEn: tmpl.titleEn,
            category: tmpl.category,
            passingScore: String(tmpl.passingScore),
            questionsJson: JSON.stringify(tmpl.questions),
            createdAt: now,
          })
          .run();
      }
    },

    async listTemplates(tenantId) {
      await this.ensureGlobalTemplates();
      const rows = await db
        .select()
        .from(assessmentTemplates)
        .where(
          or(
            isNull(assessmentTemplates.tenantId),
            eq(assessmentTemplates.tenantId, tenantId),
          ),
        )
        .all();
      return rows.map(mapTemplate);
    },

    async assign(input) {
      await db
        .insert(assessmentAssignments)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          templateId: input.templateId,
          assignedByUserId: input.assignedByUserId,
          status: "assigned",
          dueAt: input.dueAt ?? null,
          createdAt: input.createdAt,
        })
        .run();
      return {
        id: input.id,
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        templateId: input.templateId,
        status: "assigned",
        dueAt: input.dueAt ?? null,
        createdAt: input.createdAt,
      };
    },

    async listByEmployee(tenantId, employeeId) {
      const rows = await db
        .select({
          assignment: assessmentAssignments,
          titleHe: assessmentTemplates.titleHe,
        })
        .from(assessmentAssignments)
        .innerJoin(
          assessmentTemplates,
          eq(assessmentAssignments.templateId, assessmentTemplates.id),
        )
        .where(
          and(
            eq(assessmentAssignments.tenantId, tenantId),
            eq(assessmentAssignments.employeeId, employeeId),
          ),
        )
        .orderBy(desc(assessmentAssignments.createdAt))
        .all();
      return rows.map((row) => ({
        id: row.assignment.id,
        tenantId: row.assignment.tenantId,
        employeeId: row.assignment.employeeId,
        templateId: row.assignment.templateId,
        status: row.assignment.status,
        dueAt: row.assignment.dueAt ?? null,
        createdAt: row.assignment.createdAt,
        titleHe: row.titleHe,
      }));
    },

    async getAssignment(tenantId, assignmentId) {
      const row = await db
        .select({
          assignment: assessmentAssignments,
          template: assessmentTemplates,
        })
        .from(assessmentAssignments)
        .innerJoin(
          assessmentTemplates,
          eq(assessmentAssignments.templateId, assessmentTemplates.id),
        )
        .where(
          and(
            eq(assessmentAssignments.tenantId, tenantId),
            eq(assessmentAssignments.id, assignmentId),
          ),
        )
        .get();
      if (!row) return null;
      const template = mapTemplate(row.template);
      return {
        id: row.assignment.id,
        tenantId: row.assignment.tenantId,
        employeeId: row.assignment.employeeId,
        templateId: row.assignment.templateId,
        status: row.assignment.status,
        dueAt: row.assignment.dueAt ?? null,
        createdAt: row.assignment.createdAt,
        titleHe: template.titleHe,
        passingScore: template.passingScore,
        questions: template.questions.map(({ correctOptionId: _, ...q }) => q),
      };
    },

    async submit(input) {
      const row = await db
        .select({
          assignment: assessmentAssignments,
          template: assessmentTemplates,
        })
        .from(assessmentAssignments)
        .innerJoin(
          assessmentTemplates,
          eq(assessmentAssignments.templateId, assessmentTemplates.id),
        )
        .where(
          and(
            eq(assessmentAssignments.tenantId, input.tenantId),
            eq(assessmentAssignments.id, input.assignmentId),
          ),
        )
        .get();
      if (!row) return { ok: false, reason: "NOT_FOUND" };
      if (row.assignment.status === "completed") {
        return { ok: false, reason: "ALREADY_DONE" };
      }

      const template = mapTemplate(row.template);
      let correct = 0;
      for (const question of template.questions) {
        if (input.answers[question.id] === question.correctOptionId) {
          correct += 1;
        }
      }
      const score =
        template.questions.length === 0
          ? 0
          : Math.round((correct / template.questions.length) * 100);
      const passed = score >= template.passingScore;

      await db
        .insert(assessmentResults)
        .values({
          id: crypto.randomUUID(),
          assignmentId: input.assignmentId,
          score: String(score),
          passed: passed ? "1" : "0",
          answersJson: JSON.stringify(input.answers),
          completedAt: input.completedAt,
          notes: null,
          createdAt: input.completedAt,
        })
        .run();
      await db
        .update(assessmentAssignments)
        .set({ status: "completed" })
        .where(eq(assessmentAssignments.id, input.assignmentId))
        .run();

      return { ok: true, score, passed };
    },
  };
}
