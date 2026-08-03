import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { bookings, departments, hotels, tenants, users } from "./tenancy.js";

/**
 * Generic task queue shared by every hotel department except Maintenance &
 * Procurement, which gets the richer `maintenance_requests` model below.
 * See docs/planning/facilities-ops-module.md.
 */
export const departmentTasks = sqliteTable(
  "department_tasks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    departmentId: text("department_id")
      .notNull()
      .references(() => departments.id),
    taskType: text("task_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    priority: text("priority").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id),
    dueAt: text("due_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [
    index("department_tasks_tenant_idx").on(table.tenantId),
    index("department_tasks_hotel_idx").on(table.hotelId),
    index("department_tasks_department_idx").on(table.departmentId),
    index("department_tasks_hotel_status_idx").on(table.hotelId, table.status),
  ],
);

export const vendors = sqliteTable(
  "vendors",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id").references(() => hotels.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    rating: integer("rating"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("vendors_tenant_idx").on(table.tenantId),
    index("vendors_hotel_idx").on(table.hotelId),
  ],
);

export const maintenanceRequests = sqliteTable(
  "maintenance_requests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    departmentId: text("department_id").references(() => departments.id),
    category: text("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    priority: text("priority").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id),
    vendorId: text("vendor_id").references(() => vendors.id),
    dueAt: text("due_at"),
    slaHours: integer("sla_hours"),
    estimatedCost: integer("estimated_cost"),
    actualCost: integer("actual_cost"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [
    index("maintenance_requests_tenant_idx").on(table.tenantId),
    index("maintenance_requests_hotel_idx").on(table.hotelId),
    index("maintenance_requests_hotel_status_idx").on(
      table.hotelId,
      table.status,
    ),
    index("maintenance_requests_category_idx").on(table.category),
  ],
);

export const maintenanceRequestPhotos = sqliteTable(
  "maintenance_request_photos",
  {
    id: text("id").primaryKey(),
    maintenanceRequestId: text("maintenance_request_id")
      .notNull()
      .references(() => maintenanceRequests.id),
    phase: text("phase").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("maintenance_request_photos_request_idx").on(
      table.maintenanceRequestId,
    ),
  ],
);

export const vendorQuotes = sqliteTable(
  "vendor_quotes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    maintenanceRequestId: text("maintenance_request_id").references(
      () => maintenanceRequests.id,
    ),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendors.id),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    validUntil: text("valid_until"),
    status: text("status").notNull(),
    documentStorageKey: text("document_storage_key"),
    submittedAt: text("submitted_at").notNull(),
    decidedByUserId: text("decided_by_user_id").references(() => users.id),
    decidedAt: text("decided_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("vendor_quotes_tenant_idx").on(table.tenantId),
    index("vendor_quotes_request_idx").on(table.maintenanceRequestId),
    index("vendor_quotes_vendor_idx").on(table.vendorId),
  ],
);

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    category: text("category").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    currentStock: integer("current_stock").notNull(),
    reorderThreshold: integer("reorder_threshold").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("inventory_items_tenant_idx").on(table.tenantId),
    index("inventory_items_hotel_idx").on(table.hotelId),
    index("inventory_items_hotel_category_idx").on(
      table.hotelId,
      table.category,
    ),
  ],
);

export const inventoryTransactions = sqliteTable(
  "inventory_transactions",
  {
    id: text("id").primaryKey(),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    relatedPurchaseOrderId: text("related_purchase_order_id"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("inventory_transactions_item_idx").on(table.inventoryItemId),
  ],
);

export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    vendorId: text("vendor_id")
      .notNull()
      .references(() => vendors.id),
    status: text("status").notNull(),
    totalAmount: integer("total_amount").notNull(),
    currency: text("currency").notNull(),
    expectedDeliveryAt: text("expected_delivery_at"),
    receivedAt: text("received_at"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("purchase_orders_tenant_idx").on(table.tenantId),
    index("purchase_orders_hotel_idx").on(table.hotelId),
    index("purchase_orders_hotel_status_idx").on(table.hotelId, table.status),
  ],
);

export const purchaseOrderItems = sqliteTable(
  "purchase_order_items",
  {
    id: text("id").primaryKey(),
    purchaseOrderId: text("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id),
    inventoryItemId: text("inventory_item_id").references(
      () => inventoryItems.id,
    ),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("purchase_order_items_order_idx").on(table.purchaseOrderId),
  ],
);

/**
 * External OTA / Google reputation reviews — ingested via webhook or staff path.
 * Negative or low-rated reviews can spawn front-office department_tasks.
 */
export const reputationReviews = sqliteTable(
  "reputation_reviews",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    authorName: text("author_name"),
    reviewUrl: text("review_url"),
    reviewedAt: text("reviewed_at").notNull(),
    sentiment: text("sentiment").notNull(),
    topicsJson: text("topics_json").notNull(),
    taskId: text("task_id").references(() => departmentTasks.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("reputation_reviews_tenant_idx").on(table.tenantId),
    index("reputation_reviews_hotel_idx").on(table.hotelId),
    index("reputation_reviews_hotel_reviewed_idx").on(
      table.hotelId,
      table.reviewedAt,
    ),
    index("reputation_reviews_source_external_idx").on(
      table.tenantId,
      table.source,
      table.externalId,
    ),
  ],
);

export const guestFeedback = sqliteTable(
  "guest_feedback",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    bookingId: text("booking_id").references(() => bookings.id),
    rating: integer("rating").notNull(),
    categoriesJson: text("categories_json").notNull(),
    comment: text("comment"),
    source: text("source").notNull(),
    submittedAt: text("submitted_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("guest_feedback_tenant_idx").on(table.tenantId),
    index("guest_feedback_hotel_idx").on(table.hotelId),
  ],
);

/**
 * HR department recruiting tracker. Yad2 and most Israeli job boards have no
 * public API for automated posting or candidate scraping, so this is a
 * link-based tracker (external board + URL + manual candidate pipeline), not
 * a live integration. See docs/planning/facilities-ops-module.md.
 */
export const jobPostings = sqliteTable(
  "job_postings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    title: text("title").notNull(),
    boardName: text("board_name").notNull(),
    externalUrl: text("external_url"),
    status: text("status").notNull(),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
    closedAt: text("closed_at"),
  },
  (table) => [
    index("job_postings_tenant_idx").on(table.tenantId),
    index("job_postings_hotel_idx").on(table.hotelId),
  ],
);

export const jobCandidates = sqliteTable(
  "job_candidates",
  {
    id: text("id").primaryKey(),
    jobPostingId: text("job_posting_id")
      .notNull()
      .references(() => jobPostings.id),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    source: text("source").notNull(),
    stage: text("stage").notNull(),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("job_candidates_posting_idx").on(table.jobPostingId),
  ],
);

/** AI/rules upsell offers for in-house and upcoming guest stays. */
export const upsellOffers = sqliteTable(
  "upsell_offers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    bookingId: text("booking_id").references(() => bookings.id),
    guestEmail: text("guest_email"),
    offerType: text("offer_type").notNull(),
    titleHe: text("title_he").notNull(),
    descriptionHe: text("description_he").notNull(),
    priceAmount: integer("price_amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    source: text("source").notNull(),
    suggestedAt: text("suggested_at").notNull(),
    decidedAt: text("decided_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("upsell_offers_tenant_idx").on(table.tenantId),
    index("upsell_offers_hotel_idx").on(table.hotelId),
    index("upsell_offers_booking_idx").on(table.bookingId),
    index("upsell_offers_hotel_booking_idx").on(table.hotelId, table.bookingId),
    index("upsell_offers_booking_type_status_idx").on(
      table.bookingId,
      table.offerType,
      table.status,
    ),
  ],
);

/**
 * Revenue rate suggestions (HITL) — deterministic occupancy rules, no PMS writeback.
 * Staff approve/reject before any pricing action outside HotelOS.
 */
export const revenueSuggestions = sqliteTable(
  "revenue_suggestions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    currentOccupancyPct: integer("current_occupancy_pct").notNull(),
    suggestedDeltaPct: integer("suggested_delta_pct").notNull(),
    rationaleHe: text("rationale_he").notNull(),
    status: text("status").notNull(),
    decidedByUserId: text("decided_by_user_id").references(() => users.id),
    decidedAt: text("decided_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("revenue_suggestions_tenant_idx").on(table.tenantId),
    index("revenue_suggestions_hotel_idx").on(table.hotelId),
    index("revenue_suggestions_hotel_status_idx").on(
      table.hotelId,
      table.status,
    ),
    index("revenue_suggestions_hotel_period_idx").on(
      table.hotelId,
      table.periodStart,
    ),
  ],
);

/**
 * Optional meter readings from BMS / utility webhooks (no live BMS required for MVP).
 * Ingest via POST /v1/public/energy/ingest with ENERGY_INGEST_SECRET.
 */
export const energyReadings = sqliteTable(
  "energy_readings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    meterKind: text("meter_kind").notNull(),
    kwh: integer("kwh"),
    recordedAt: text("recorded_at").notNull(),
    source: text("source").notNull(),
  },
  (table) => [
    index("energy_readings_tenant_idx").on(table.tenantId),
    index("energy_readings_hotel_idx").on(table.hotelId),
    index("energy_readings_hotel_recorded_idx").on(
      table.hotelId,
      table.recordedAt,
    ),
  ],
);

/**
 * Daily HVAC/electricity suggestions from occupancy heuristics (HITL — no BMS writeback).
 */
export const energySuggestions = sqliteTable(
  "energy_suggestions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    periodDate: text("period_date").notNull(),
    occupancyPct: integer("occupancy_pct").notNull(),
    suggestionHe: text("suggestion_he").notNull(),
    estimatedSavingPct: integer("estimated_saving_pct").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("energy_suggestions_tenant_idx").on(table.tenantId),
    index("energy_suggestions_hotel_idx").on(table.hotelId),
    index("energy_suggestions_hotel_status_idx").on(
      table.hotelId,
      table.status,
    ),
    index("energy_suggestions_hotel_period_idx").on(
      table.hotelId,
      table.periodDate,
    ),
  ],
);

/**
 * Equipment assets for predictive maintenance MVP (no live IoT required).
 * Signals ingested via webhook stub or manual entry; predictions from rules engine.
 */
export const equipmentAssets = sqliteTable(
  "equipment_assets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    code: text("code").notNull(),
    nameHe: text("name_he").notNull(),
    category: text("category").notNull(),
    locationHe: text("location_he").notNull(),
    installDate: text("install_date"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("equipment_assets_tenant_idx").on(table.tenantId),
    index("equipment_assets_hotel_idx").on(table.hotelId),
    index("equipment_assets_hotel_code_idx").on(table.hotelId, table.code),
  ],
);

export const equipmentSignals = sqliteTable(
  "equipment_signals",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => equipmentAssets.id),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    signalType: text("signal_type").notNull(),
    valueNum: integer("value_num"),
    valueText: text("value_text"),
    recordedAt: text("recorded_at").notNull(),
    source: text("source").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("equipment_signals_tenant_idx").on(table.tenantId),
    index("equipment_signals_hotel_idx").on(table.hotelId),
    index("equipment_signals_asset_idx").on(table.assetId),
    index("equipment_signals_asset_recorded_idx").on(
      table.assetId,
      table.recordedAt,
    ),
  ],
);

export const maintenancePredictions = sqliteTable(
  "maintenance_predictions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    assetId: text("asset_id")
      .notNull()
      .references(() => equipmentAssets.id),
    riskScore: integer("risk_score").notNull(),
    rationaleHe: text("rationale_he").notNull(),
    recommendedActionHe: text("recommended_action_he").notNull(),
    status: text("status").notNull(),
    taskId: text("task_id").references(() => departmentTasks.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("maintenance_predictions_tenant_idx").on(table.tenantId),
    index("maintenance_predictions_hotel_idx").on(table.hotelId),
    index("maintenance_predictions_hotel_status_idx").on(
      table.hotelId,
      table.status,
    ),
    index("maintenance_predictions_asset_idx").on(table.assetId),
  ],
);

/** Guest outbound notifications (WhatsApp/SMS) — sync send on enqueue + optional cron drain. */
export const notificationOutbox = sqliteTable(
  "notification_outbox",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    bookingId: text("booking_id").references(() => bookings.id),
    channel: text("channel").notNull(),
    eventKey: text("event_key").notNull(),
    toAddress: text("to_address"),
    body: text("body").notNull(),
    status: text("status").notNull(),
    error: text("error"),
    provider: text("provider").notNull(),
    attemptCount: integer("attempt_count", { mode: "number" })
      .notNull()
      .default(0),
    nextAttemptAt: text("next_attempt_at"),
    createdAt: text("created_at").notNull(),
    sentAt: text("sent_at"),
  },
  (table) => [
    index("notification_outbox_tenant_idx").on(table.tenantId),
    index("notification_outbox_hotel_idx").on(table.hotelId),
    index("notification_outbox_booking_idx").on(table.bookingId),
    index("notification_outbox_hotel_status_idx").on(
      table.hotelId,
      table.status,
    ),
  ],
);
