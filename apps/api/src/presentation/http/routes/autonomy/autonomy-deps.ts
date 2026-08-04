import type { JwtTokenService } from "@hotelos/auth";
import type {
  ApprovalRepository,
  AuditRepository,
  BookingRepository,
  FeedbackRepository,
  MaintenanceRepository,
  OpsRepository,
  ProcurementRepository,
  RecruitingRepository,
  RoomRepository,
  TurboRepository,
} from "@hotelos/database";

export type AutonomyRouteDeps = {
  readonly approvals: ApprovalRepository;
  readonly audit: AuditRepository;
  readonly ops: OpsRepository;
  readonly procurement: ProcurementRepository;
  readonly maintenance: MaintenanceRepository;
  readonly rooms: RoomRepository;
  readonly bookings: BookingRepository;
  readonly recruiting: RecruitingRepository;
  readonly feedback: FeedbackRepository;
  readonly turbo: TurboRepository;
  readonly tokens: JwtTokenService;
};
