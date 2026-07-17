import { eq } from "drizzle-orm";
import type { AgentId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { AGENT_CATALOG } from "../catalog/agent-catalog.js";
import type { HotelOsDb } from "../client.js";
import { agents } from "../schema/briefing.js";

export type PersistedAgent = {
  readonly id: AgentId;
  readonly nameHe: string;
  readonly nameEn: string;
  readonly domain: string;
  readonly summaryHe: string;
  readonly autonomyMode: string;
};

export type AgentRepository = {
  ensureCatalog: () => Promise<void>;
  listAll: () => Promise<readonly PersistedAgent[]>;
  findById: (agentId: AgentId) => Promise<PersistedAgent | null>;
};

function mapAgent(row: typeof agents.$inferSelect): PersistedAgent {
  return {
    id: Ids.agent(row.id),
    nameHe: row.nameHe,
    nameEn: row.nameEn,
    domain: row.domain,
    summaryHe: row.summaryHe,
    autonomyMode: row.autonomyMode,
  };
}

export function createAgentRepository(db: HotelOsDb): AgentRepository {
  return {
    async ensureCatalog() {
      const now = new Date().toISOString();
      for (const entry of AGENT_CATALOG) {
        const existing = db
          .select()
          .from(agents)
          .where(eq(agents.id, entry.id))
          .get();
        if (existing) {
          continue;
        }
        db.insert(agents)
          .values({
            id: entry.id,
            nameHe: entry.nameHe,
            nameEn: entry.nameEn,
            domain: entry.domain,
            summaryHe: entry.summaryHe,
            autonomyMode: entry.autonomyMode,
            createdAt: now,
          })
          .run();
      }
    },

    async listAll() {
      return db
        .select()
        .from(agents)
        .all()
        .map(mapAgent);
    },

    async findById(agentId) {
      const row = db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .get();
      return row ? mapAgent(row) : null;
    },
  };
}
