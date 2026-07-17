import type {
  ChainId,
  DepartmentId,
  HotelId,
  TenantId,
  UserId,
} from "@hotelos/shared";

/**
 * Platform → Tenant → Hotel Chain → Hotel → Department → User
 * (Engineering Standard Volume 1 / 6 / 5A)
 */
export type TenancyScope = {
  readonly tenantId: TenantId;
  readonly chainId?: ChainId;
  readonly hotelId?: HotelId;
  readonly departmentId?: DepartmentId;
};

export type AuthPrincipal = {
  readonly userId: UserId;
  readonly roles: readonly string[];
  readonly scope: TenancyScope;
};

export function assertSameTenant(
  left: TenantId,
  right: TenantId,
): void {
  if (left !== right) {
    throw new Error("TENANT_ISOLATION_VIOLATION");
  }
}

export function canAccessHotel(
  principal: AuthPrincipal,
  hotelId: HotelId,
): boolean {
  if (principal.scope.hotelId === undefined) {
    // Chain/tenant-level role may access any hotel in tenant (refined later by ABAC).
    return true;
  }
  return principal.scope.hotelId === hotelId;
}
