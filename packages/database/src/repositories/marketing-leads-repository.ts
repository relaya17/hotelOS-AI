import type { HotelOsDb } from "../client.js";
import { marketingLeads } from "../schema/marketing.js";

export type CreateMarketingLeadInput = {
  readonly id: string;
  readonly name: string;
  readonly hotelOrChain: string;
  readonly email: string;
  readonly note: string | null;
  readonly source: string;
  readonly createdAt: string;
};

export type PersistedMarketingLead = {
  readonly id: string;
  readonly name: string;
  readonly hotelOrChain: string;
  readonly email: string;
  readonly note: string | null;
  readonly source: string;
  readonly createdAt: string;
};

export type MarketingLeadsRepository = {
  create: (input: CreateMarketingLeadInput) => Promise<PersistedMarketingLead>;
};

export function createMarketingLeadsRepository(
  db: HotelOsDb,
): MarketingLeadsRepository {
  return {
    async create(input) {
      await db
        .insert(marketingLeads)
        .values({
          id: input.id,
          name: input.name,
          hotelOrChain: input.hotelOrChain,
          email: input.email,
          note: input.note,
          source: input.source,
          createdAt: input.createdAt,
        })
        .run();
      return {
        id: input.id,
        name: input.name,
        hotelOrChain: input.hotelOrChain,
        email: input.email,
        note: input.note,
        source: input.source,
        createdAt: input.createdAt,
      };
    },
  };
}
