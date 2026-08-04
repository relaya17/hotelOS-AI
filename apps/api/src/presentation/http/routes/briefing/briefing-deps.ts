import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  AgentRepository,
  ApprovalRepository,
  AuditRepository,
  BriefingRepository,
  OverviewRepository,
  UserRepository,
} from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import type { RecordingStorage } from "../../../../infrastructure/recording-storage.js";

export type BriefingRouteDeps = {
  readonly audit: AuditRepository;
  readonly briefing: BriefingRepository;
  readonly agents: AgentRepository;
  readonly overview: OverviewRepository;
  readonly users: UserRepository;
  readonly tokens: JwtTokenService;
  readonly recordings: RecordingStorage;
  readonly gateway: AiGateway;
  readonly approvals: ApprovalRepository;
};
