import type { PmsConnector } from "@hotelos/connectors";
import type {
  AuditRepository,
  BookingRepository,
  EquipmentRepository,
  FeedbackRepository,
  EnergyRepository,
  GuestProfileRepository,
  GuestStayRepository,
  HotelRepository,
  HrRepository,
  OpsRepository,
  ReputationRepository,
  RoomRepository,
  TrustRepository,
  TurboRepository,
  UpsellRepository,
} from "@hotelos/database";
import type { PaymentProvider } from "../../../../infrastructure/payment-provider.js";

export type PublicRouteDeps = {
  readonly guestStays: GuestStayRepository;
  readonly feedback: FeedbackRepository;
  readonly upsells: UpsellRepository;
  readonly hr: HrRepository;
  readonly ops: OpsRepository;
  readonly reputation: ReputationRepository;
  readonly guestProfiles?: GuestProfileRepository;
  readonly hotels: HotelRepository;
  readonly rooms: RoomRepository;
  readonly bookings: BookingRepository;
  readonly audit: AuditRepository;
  readonly trust: TrustRepository;
  readonly turbo: TurboRepository;
  readonly payments: PaymentProvider;
  readonly pms?: PmsConnector;
  /** When set, inbound PMS webhook requires Bearer / X-HotelOS-Pms-Secret. */
  readonly pmsInboundSecret?: string;
  /**
   * VMS webhook secret (Bearer / X-HotelOS-Security-Secret).
   * Required in production; optional in development.
   */
  readonly securityIngestSecret?: string;
  /**
   * Sentry webhook secret (Bearer / X-HotelOS-Sentry-Secret).
   * Required in production when Sentry → HotelOS IT ingest is enabled.
   */
  readonly sentryIngestSecret?: string;
  /** Fallback hotel UUID when Sentry events lack a hotelId tag. */
  readonly sentryDefaultHotelId?: string;
  /**
   * Reputation webhook secret (Bearer / X-HotelOS-Reputation-Secret).
   * Required in production when OTA review ingest is enabled.
   */
  readonly reputationIngestSecret?: string;
  readonly energyIngestSecret?: string;
  readonly energy?: EnergyRepository;
  readonly equipmentIngestSecret?: string;
  readonly equipment?: EquipmentRepository;
  readonly isProduction?: boolean;
};
