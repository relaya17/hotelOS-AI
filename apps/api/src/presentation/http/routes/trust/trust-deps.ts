import type {
  AuditRepository,
  RefreshSessionRepository,
  TrustRepository,
  UserRepository,
} from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import type { PaymentProvider } from "../../../../infrastructure/payment-provider.js";

export type TrustRouteDeps = {
  readonly trust: TrustRepository;
  readonly users: UserRepository;
  readonly sessions: RefreshSessionRepository;
  readonly audit: AuditRepository;
  readonly tokens: JwtTokenService;
  readonly payments: PaymentProvider;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly googleRedirectUri: string;
  readonly googlePostLoginRedirect: string;
  readonly webauthnRpId: string;
  readonly webauthnRpName: string;
  /** When false, Google demo login is rejected (default in production). */
  readonly allowDemoAuth: boolean;
  /** Allowed WebAuthn clientData.origin values (CORS origins). */
  readonly webauthnOrigins: readonly string[];
};
