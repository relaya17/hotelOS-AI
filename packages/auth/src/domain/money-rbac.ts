import type { AuthPrincipal } from "./tenancy.js";
import { hasAnyRole } from "./tenancy.js";

/** Can draft/receive POs and open money-related Suggest HITL. */
export const PROCUREMENT_OPERATOR_ROLES = [
  "admin",
  "executive",
  "owner",
  "cfo",
  "gm",
  "procurement",
] as const;

/** Can approve money Acts at hotel threshold (₪2k+). */
export const HOTEL_MONEY_APPROVER_ROLES = [
  "admin",
  "executive",
  "owner",
  "cfo",
  "gm",
] as const;

/** Can approve money Acts at chain threshold (₪5k+). */
export const CHAIN_MONEY_APPROVER_ROLES = [
  "admin",
  "executive",
  "owner",
  "cfo",
] as const;

/** Can decide non-money HITL (tasks, HK, reception, recruiting). */
export const OPS_HITL_ROLES = [
  "admin",
  "executive",
  "owner",
  "gm",
  "cfo",
  "procurement",
  "reception",
  "housekeeping",
  "hr",
] as const;

export type MoneyApprovalThresholds = {
  readonly hotelIls: number;
  readonly chainIls: number;
};

export function canOperateProcurement(principal: AuthPrincipal): boolean {
  return hasAnyRole(principal, PROCUREMENT_OPERATOR_ROLES);
}

export function canDecideOpsHitl(principal: AuthPrincipal): boolean {
  return hasAnyRole(principal, OPS_HITL_ROLES);
}

/**
 * Role gate for money Approvals / direct quote accept by ILS amount.
 * Below hotel threshold: any procurement operator. At/above hotel: GM+.
 * At/above chain: executive/owner/cfo/admin only.
 */
export function canApproveMoneyAmount(
  principal: AuthPrincipal,
  amountIls: number,
  thresholds: MoneyApprovalThresholds,
): boolean {
  if (amountIls >= thresholds.chainIls) {
    return hasAnyRole(principal, CHAIN_MONEY_APPROVER_ROLES);
  }
  if (amountIls >= thresholds.hotelIls) {
    return hasAnyRole(principal, HOTEL_MONEY_APPROVER_ROLES);
  }
  return canOperateProcurement(principal);
}
