import { authGet, authPut } from "./core.js";

export type IntegrationDomainStatus = "adapters" | "mvp" | "deferred";

export type IntegrationDomainDto = {
  readonly id: string;
  readonly titleHe: string;
  readonly examples: readonly string[];
  readonly status: IntegrationDomainStatus;
};

export type IntegrationsCatalogDto = {
  readonly domains: readonly IntegrationDomainDto[];
  readonly live: {
    readonly pmsProvider: string;
    readonly mewsConfigured?: boolean;
    readonly pmsLiveReady?: boolean;
  };
  readonly enabledForHotel?: readonly string[];
};

export async function fetchIntegrationsCatalog(
  hotelId?: string,
): Promise<IntegrationsCatalogDto> {
  const path =
    hotelId !== undefined
      ? `/v1/integrations/catalog?hotelId=${encodeURIComponent(hotelId)}`
      : "/v1/integrations/catalog";
  const payload = (await authGet(path)) as {
    data: IntegrationsCatalogDto;
  };
  return payload.data;
}

export async function putHotelIntegrationDomains(
  hotelId: string,
  enabled: readonly string[],
): Promise<{ readonly hotelId: string; readonly enabled: readonly string[] }> {
  const payload = (await authPut(`/v1/integrations/hotels/${hotelId}/domains`, {
    enabled,
  })) as {
    data: { hotelId: string; enabled: readonly string[] };
  };
  return payload.data;
}
