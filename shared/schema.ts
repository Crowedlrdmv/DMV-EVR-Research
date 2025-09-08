import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, serial, integer, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums for state research pipeline
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "success", "error"]);
export const programTypeEnum = pgEnum("program_type", ["rules", "emissions", "inspections", "bulletins", "forms"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const complianceRecords = pgTable("compliance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: text("vehicle_id").notNull(),
  complianceStatus: text("compliance_status").notNull(),
  expiryDate: timestamp("expiry_date"),
  verificationTimestamp: timestamp("verification_timestamp").defaultNow().notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationData: jsonb("verification_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const states = pgTable("states", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 2 }).unique().notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stateResults = pgTable("state_results", {
  stateId: integer("state_id").primaryKey().references(() => states.id, { onDelete: "cascade" }),
  evrExists: text("evr_exists"),
  evrSourceUrl: text("evr_source_url"),
  evrMandatoryForDealers: text("evr_mandatory_for_dealers"),
  evrRequirementSourceUrl: text("evr_requirement_source_url"),
  digitalFormsAllowed: text("digital_forms_allowed"),
  digitalFormsSourceUrl: text("digital_forms_source_url"),
  ownershipTransferProcess: text("ownership_transfer_process"),
  ownershipTransferSourceUrl: text("ownership_transfer_source_url"),
  typicalTitleIssuanceTime: text("typical_title_issuance_time"),
  titleIssuanceSourceUrl: text("title_issuance_source_url"),
  dealerMayIssueTempTag: text("dealer_may_issue_temp_tag"),
  tempTagIssuanceSourceUrl: text("temp_tag_issuance_source_url"),
  tempTagIssuanceMethod: text("temp_tag_issuance_method"),
  tempTagIssuanceMethodSourceUrl: text("temp_tag_issuance_method_source_url"),
  tempTagDurationDays: integer("temp_tag_duration_days"),
  tempTagDurationSourceUrl: text("temp_tag_duration_source_url"),
  tempTagRenewable: text("temp_tag_renewable"),
  tempTagRenewalSourceUrl: text("temp_tag_renewal_source_url"),
  tempTagFeeWhoPays: text("temp_tag_fee_who_pays"),
  tempTagFeeSourceUrl: text("temp_tag_fee_source_url"),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stateSources = pgTable("state_sources", {
  id: serial("id").primaryKey(),
  stateId: integer("state_id").references(() => states.id, { onDelete: "cascade" }).notNull(),
  fieldKey: text("field_key").notNull(),
  url: text("url").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// State research pipeline tables
export const fetchJobs = pgTable("fetch_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  state: varchar("state", { length: 2 }).notNull(),
  dataTypes: jsonb("data_types").notNull(), // Array of strings
  status: jobStatusEnum("status").default("queued").notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  statsJson: jsonb("stats_json"),
  errorText: text("error_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  statusStateIdx: index("fetch_jobs_status_state_idx").on(table.status, table.state),
  startedAtIdx: index("fetch_jobs_started_at_idx").on(table.startedAt),
}));

export const fetchArtifacts = pgTable("fetch_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => fetchJobs.id, { onDelete: "cascade" }).notNull(),
  sourceId: text("source_id").notNull(),
  url: text("url").notNull(),
  hash: varchar("hash", { length: 64 }).notNull(), // SHA-256
  contentType: text("content_type"),
  filePath: text("file_path"), // Path to stored artifact file
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  metaJson: jsonb("meta_json"),
}, (table) => ({
  urlHashIdx: index("fetch_artifacts_url_hash_idx").on(table.url, table.hash),
  jobIdIdx: index("fetch_artifacts_job_id_idx").on(table.jobId),
}));

export const programs = pgTable("programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  state: varchar("state", { length: 2 }).notNull(),
  type: programTypeEnum("type").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  effectiveDate: timestamp("effective_date"),
  lastUpdated: timestamp("last_updated"),
  summary: text("summary"),
  rawSourceId: varchar("raw_source_id").references(() => fetchArtifacts.id),
  version: integer("version").default(1).notNull(),
  validFrom: timestamp("valid_from").defaultNow().notNull(),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  stateTypeIdx: index("programs_state_type_idx").on(table.state, table.type),
  validFromToIdx: index("programs_valid_from_to_idx").on(table.validFrom, table.validTo),
}));

export const requirements = pgTable("requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").references(() => programs.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  frequency: text("frequency"),
  appliesTo: text("applies_to"),
  citationsJson: jsonb("citations_json"),
  sourceCitations: text("source_citations"), // URL + anchor text
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  programIdIdx: index("requirements_program_id_idx").on(table.programId),
}));

export const fees = pgTable("fees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").references(() => programs.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  amountCents: integer("amount_cents"),
  unit: text("unit"),
  effectiveDate: timestamp("effective_date"),
  sourceCitations: text("source_citations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  programIdIdx: index("fees_program_id_idx").on(table.programId),
  effectiveDateIdx: index("fees_effective_date_idx").on(table.effectiveDate),
}));

export const deadlines = pgTable("deadlines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").references(() => programs.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  ruleJson: jsonb("rule_json").notNull(),
  sourceCitations: text("source_citations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  programIdIdx: index("deadlines_program_id_idx").on(table.programId),
}));

export const programDeltas = pgTable("program_deltas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").references(() => programs.id, { onDelete: "cascade" }).notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  changeJson: jsonb("change_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  programIdIdx: index("program_deltas_program_id_idx").on(table.programId),
  changedAtIdx: index("program_deltas_changed_at_idx").on(table.changedAt),
}));

// Relations
export const statesRelations = relations(states, ({ one, many }) => ({
  results: one(stateResults),
  sources: many(stateSources),
}));

export const stateResultsRelations = relations(stateResults, ({ one }) => ({
  state: one(states, {
    fields: [stateResults.stateId],
    references: [states.id],
  }),
}));

export const stateSourcesRelations = relations(stateSources, ({ one }) => ({
  state: one(states, {
    fields: [stateSources.stateId],
    references: [states.id],
  }),
}));

// State research pipeline relations
export const fetchJobsRelations = relations(fetchJobs, ({ many }) => ({
  artifacts: many(fetchArtifacts),
}));

export const fetchArtifactsRelations = relations(fetchArtifacts, ({ one, many }) => ({
  job: one(fetchJobs, {
    fields: [fetchArtifacts.jobId],
    references: [fetchJobs.id],
  }),
  programs: many(programs),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  rawSource: one(fetchArtifacts, {
    fields: [programs.rawSourceId],
    references: [fetchArtifacts.id],
  }),
  requirements: many(requirements),
  fees: many(fees),
  deadlines: many(deadlines),
  deltas: many(programDeltas),
}));

export const requirementsRelations = relations(requirements, ({ one }) => ({
  program: one(programs, {
    fields: [requirements.programId],
    references: [programs.id],
  }),
}));

export const feesRelations = relations(fees, ({ one }) => ({
  program: one(programs, {
    fields: [fees.programId],
    references: [programs.id],
  }),
}));

export const deadlinesRelations = relations(deadlines, ({ one }) => ({
  program: one(programs, {
    fields: [deadlines.programId],
    references: [programs.id],
  }),
}));

export const programDeltasRelations = relations(programDeltas, ({ one }) => ({
  program: one(programs, {
    fields: [programDeltas.programId],
    references: [programs.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertComplianceRecordSchema = createInsertSchema(complianceRecords).omit({
  id: true,
  createdAt: true,
  verificationTimestamp: true,
});

export const insertStateSchema = createInsertSchema(states).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStateResultsSchema = createInsertSchema(stateResults).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertStateSourcesSchema = createInsertSchema(stateSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// State research pipeline insert schemas
export const insertFetchJobSchema = createInsertSchema(fetchJobs).omit({
  id: true,
  createdAt: true,
});

export const insertFetchArtifactSchema = createInsertSchema(fetchArtifacts).omit({
  id: true,
  fetchedAt: true,
});

export const insertProgramSchema = createInsertSchema(programs).omit({
  id: true,
  validFrom: true,
  createdAt: true,
});

export const insertRequirementSchema = createInsertSchema(requirements).omit({
  id: true,
  createdAt: true,
});

export const insertFeeSchema = createInsertSchema(fees).omit({
  id: true,
  createdAt: true,
});

export const insertDeadlineSchema = createInsertSchema(deadlines).omit({
  id: true,
  createdAt: true,
});

export const insertProgramDeltaSchema = createInsertSchema(programDeltas).omit({
  id: true,
  changedAt: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type InsertComplianceRecord = z.infer<typeof insertComplianceRecordSchema>;

export type State = typeof states.$inferSelect;
export type InsertState = z.infer<typeof insertStateSchema>;
export type StateResults = typeof stateResults.$inferSelect;
export type InsertStateResults = z.infer<typeof insertStateResultsSchema>;
export type StateSources = typeof stateSources.$inferSelect;
export type InsertStateSources = z.infer<typeof insertStateSourcesSchema>;

// State research pipeline types
export type FetchJob = typeof fetchJobs.$inferSelect;
export type InsertFetchJob = z.infer<typeof insertFetchJobSchema>;
export type FetchArtifact = typeof fetchArtifacts.$inferSelect;
export type InsertFetchArtifact = z.infer<typeof insertFetchArtifactSchema>;
export type Program = typeof programs.$inferSelect;
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type Requirement = typeof requirements.$inferSelect;
export type InsertRequirement = z.infer<typeof insertRequirementSchema>;
export type Fee = typeof fees.$inferSelect;
export type InsertFee = z.infer<typeof insertFeeSchema>;
export type Deadline = typeof deadlines.$inferSelect;
export type InsertDeadline = z.infer<typeof insertDeadlineSchema>;
export type ProgramDelta = typeof programDeltas.$inferSelect;
export type InsertProgramDelta = z.infer<typeof insertProgramDeltaSchema>;
