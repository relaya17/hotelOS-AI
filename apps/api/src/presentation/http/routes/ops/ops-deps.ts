import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  AuditRepository,
  BookingRepository,
  BriefingRepository,
  CompanyKnowledgeRepository,
  EquipmentRepository,
  FeedbackRepository,
  HotelRepository,
  KashrutRepository,
  MaintenanceRepository,
  OpsRepository,
  OverviewRepository,
  ProcurementRepository,
  RecruitingRepository,
  RevenueSuggestionsRepository,
  ReputationRepository,
  GuestProfileRepository,
  RoomRepository,
  TrustedSourceSnapshotsRepository,
  TrustedSourcesRepository,
  TurboRepository,
  UpsellRepository,
} from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";

export type OpsRouteDeps = {
  readonly audit: AuditRepository;
  readonly ops: OpsRepository;
  readonly maintenance: MaintenanceRepository;
  readonly procurement: ProcurementRepository;
  readonly feedback: FeedbackRepository;
  readonly reputation: ReputationRepository;
  readonly recruiting: RecruitingRepository;
  readonly hotels: HotelRepository;
  readonly overview: OverviewRepository;
  readonly bookings: BookingRepository;
  readonly briefing: BriefingRepository;
  readonly upsells: UpsellRepository;
  readonly revenueSuggestions: RevenueSuggestionsRepository;
  readonly equipment: EquipmentRepository;
  readonly kashrut: KashrutRepository;
  readonly turbo: TurboRepository;
  readonly gateway: AiGateway;
  readonly companyKnowledge: CompanyKnowledgeRepository;
  readonly trustedSources: TrustedSourcesRepository;
  readonly snapshots: TrustedSourceSnapshotsRepository;
  readonly guestProfiles?: GuestProfileRepository;
  readonly rooms: RoomRepository;
  readonly tokens: JwtTokenService;
};
