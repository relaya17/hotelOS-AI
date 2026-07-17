import { Hono } from "hono";
import type { TurboRepository, UserRepository } from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import {
  isLocaleCode,
  translateChatInstruction,
  type LocaleCode,
} from "@hotelos/i18n";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import { resolveVoiceIntent } from "../../application/resolve-voice-intent.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type TurboRouteDeps = {
  readonly turbo: TurboRepository;
  readonly users: UserRepository;
  readonly tokens: JwtTokenService;
};

const postChatSchema = z.object({
  channel: z.string().trim().min(2).max(40).default("ops"),
  body: z.string().trim().min(2).max(2000),
  sourceLocale: z.string().min(2).max(8).default("he"),
});

const toggleSchema = z.object({
  enabled: z.boolean(),
});

const voiceSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
});

export function createTurboRoutes(deps: TurboRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/locales", (c) =>
    c.json({
      data: {
        supported: [
          "he",
          "en",
          "ar",
          "ru",
          "es",
          "th",
          "zh",
          "hi",
          "tr",
          "el",
        ],
        uiVerification: "verified",
        chatPolicy:
          "Instructions are authored once; each employee receives verified or provisional translation in preferred_locale",
      },
    }),
  );

  routes.get("/employees", async (c) => {
    try {
      const principal = c.get("principal");
      const employees = await deps.turbo.listEmployees(
        principal.scope.tenantId,
      );
      return c.json({ data: employees });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/chat/:channel", async (c) => {
    try {
      const principal = c.get("principal");
      const channel = c.req.param("channel");
      const viewerLocaleRaw = c.req.query("locale") ?? "he";
      const viewerLocale: LocaleCode = isLocaleCode(viewerLocaleRaw)
        ? viewerLocaleRaw
        : "he";
      const messages = await deps.turbo.listChatMessages(
        principal.scope.tenantId,
        channel,
      );
      const employees = await deps.turbo.listEmployees(
        principal.scope.tenantId,
      );

      return c.json({
        data: {
          channel,
          viewerLocale,
          messages: messages.map((message) => ({
            ...message,
            bodyForViewer:
              message.translations[viewerLocale] ?? message.sourceBody,
            deliveries: employees.map((employee) => ({
              employeeId: employee.id,
              displayName: employee.displayName,
              preferredLocale: employee.preferredLocale,
              body:
                message.translations[employee.preferredLocale] ??
                message.sourceBody,
            })),
          })),
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/chat", async (c) => {
    try {
      const principal = c.get("principal");
      const body = postChatSchema.parse(await c.req.json());
      const sourceLocale: LocaleCode = isLocaleCode(body.sourceLocale)
        ? body.sourceLocale
        : "he";
      const bundle = translateChatInstruction(body.body, sourceLocale);
      const user = await deps.users.findById(principal.userId);
      const message = await deps.turbo.postChatMessage({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        channel: body.channel,
        authorName: user?.displayName ?? "Staff",
        authorUserId: principal.userId,
        sourceLocale: bundle.sourceLocale,
        sourceBody: bundle.sourceText,
        translationsJson: JSON.stringify(bundle.translations),
        verification: bundle.verification,
        createdAt: new Date().toISOString(),
      });

      const translateAutomation = (
        await deps.turbo.listAutomations(principal.scope.tenantId)
      ).find((rule) => rule.actionKey === "i18n.translate.deliver");
      if (translateAutomation?.enabled) {
        await deps.turbo.runAutomation(
          principal.scope.tenantId,
          translateAutomation.id,
          `Translated instruction ${message.id} (${bundle.verification})`,
        );
      }

      return c.json({ data: message }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/accounting", async (c) => {
    try {
      const principal = c.get("principal");
      const [accounts, journal] = await Promise.all([
        deps.turbo.listAccounts(principal.scope.tenantId),
        deps.turbo.listJournal(principal.scope.tenantId),
      ]);
      return c.json({
        data: {
          mode: "advanced_internal_ledger",
          integration: {
            internalProgram: "hotelos.internal",
            externalConnectors: ["external.erp.connector"],
            note: "Accounting can run fully inside HotelOS or sync with an external ERP",
          },
          accounts,
          journal,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/automations", async (c) => {
    try {
      const principal = c.get("principal");
      const [rules, runs] = await Promise.all([
        deps.turbo.listAutomations(principal.scope.tenantId),
        deps.turbo.listAutomationRuns(principal.scope.tenantId),
      ]);
      return c.json({ data: { rules, runs: runs.slice(0, 20) } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/automations/:id/toggle", async (c) => {
    try {
      const principal = c.get("principal");
      const body = toggleSchema.parse(await c.req.json());
      const rule = await deps.turbo.setAutomationEnabled(
        principal.scope.tenantId,
        c.req.param("id"),
        body.enabled,
      );
      if (!rule) {
        return sendError(c, 404, "NOT_FOUND", "Automation not found");
      }
      return c.json({ data: rule });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/automations/:id/run", async (c) => {
    try {
      const principal = c.get("principal");
      const run = await deps.turbo.runAutomation(
        principal.scope.tenantId,
        c.req.param("id"),
        "Manual Turbo run",
      );
      if (!run) {
        return sendError(
          c,
          404,
          "NOT_FOUND",
          "Automation missing or disabled",
        );
      }
      return c.json({ data: run }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/voice/intent", async (c) => {
    try {
      const principal = c.get("principal");
      const body = voiceSchema.parse(await c.req.json());
      const intent = resolveVoiceIntent(body.transcript);
      const rules = await deps.turbo.listAutomations(principal.scope.tenantId);
      const matched = rules.find(
        (rule) =>
          rule.triggerKey === intent.automationHint ||
          rule.actionKey === intent.action,
      );
      let runId: string | undefined;
      if (matched?.enabled) {
        const run = await deps.turbo.runAutomation(
          principal.scope.tenantId,
          matched.id,
          `Voice: ${body.transcript}`,
        );
        runId = run?.id;
      }
      return c.json({
        data: {
          ...intent,
          automationId: matched?.id ?? null,
          runId: runId ?? null,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
