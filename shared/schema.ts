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

// Research jobs (core job execution tracking)
export const researchJobs = pgTable("research_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  states: text("states").array().notNull(), // Array of state codes
  dataTypes: text("data_types").array().notNull(), // Array of data types
  depth: text("depth").notNull(), // 'summary' | 'full'
  status: text("status").notNull(), // 'queued'|'running'|'succeeded'|'failed'
  resultCount: integer("result_count").default(0).notNull(),
  artifactCount: integer("artifact_count").default(0).notNull(),
  errorMessage: text("error_message"),
}, (table) => ({
  createdAtIdx: index("research_jobs_created_at_idx").on(table.createdAt.desc()),
}));

// Canonical programs (deduped across runs)
export const researchPrograms = pgTable("research_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stableKey: text("stable_key").notNull().unique(), // deterministic from normalized URL+title+state
  state: text("state").notNull(),
  type: text("type").notNull(), // rules|emissions|inspections|bulletins|forms
  title: text("title").notNull(),
  summary: text("summary"),
  sourceUrl: text("source_url"),
  lastUpdated: timestamp("last_updated"),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}, (table) => ({
  stateIdx: index("research_programs_state_idx").on(table.state),
  typeIdx: index("research_programs_type_idx").on(table.type),
  lastSeenAtIdx: index("research_programs_last_seen_at_idx").on(table.lastSeenAt.desc()),
}));

// Results linking job -> programs
export const researchJobResults = pgTable("research_job_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => researchJobs.id, { onDelete: "cascade" }),
  programId: varchar("program_id").notNull().references(() => researchPrograms.id, { onDelete: "cascade" }),
}, (table) => ({
  jobIdIdx: index("research_job_results_job_id_idx").on(table.jobId),
  uniqueJobProgram: index("research_job_results_unique_idx").on(table.jobId, table.programId),
}));

// Artifacts fetched during jobs
export const researchArtifacts = pgTable("research_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => researchJobs.id, { onDelete: "cascade" }),
  programId: varchar("program_id").references(() => researchPrograms.id, { onDelete: "set null" }),
  artifactType: text("artifact_type"), // html,pdf,json,notes
  url: text("url"),
  status: text("status"), // fetched|failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("research_artifacts_job_id_idx").on(table.jobId),
}));


export const requirements = pgTable("requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").references(() => researchPrograms.id, { onDelete: "cascade" }).notNull(),
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
  programId: varchar("program_id").references(() => researchPrograms.id, { onDelete: "cascade" }).notNull(),
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
  programId: varchar("program_id").references(() => researchPrograms.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  ruleJson: jsonb("rule_json").notNull(),
  sourceCitations: text("source_citations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  programIdIdx: index("deadlines_program_id_idx").on(table.programId),
}));

// Changes (diffs between successive comparable runs)
export const researchProgramChanges = pgTable("research_program_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => researchJobs.id, { onDelete: "cascade" }),
  programId: varchar("program_id").references(() => researchPrograms.id),
  changeType: text("change_type").notNull(), // added|removed|updated
  diff: jsonb("diff"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("research_program_changes_job_id_idx").on(table.jobId),
}));

// Schedules
export const researchSchedules = pgTable("research_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cronExpression: text("cron_expression").notNull(),
  states: text("states").array().notNull(),
  dataTypes: text("data_types").array().notNull(),
  depth: text("depth").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

// Research pipeline relations
export const researchJobsRelations = relations(researchJobs, ({ many }) => ({
  results: many(researchJobResults),
  artifacts: many(researchArtifacts),
  changes: many(researchProgramChanges),
}));

export const researchProgramsRelations = relations(researchPrograms, ({ many }) => ({
  jobResults: many(researchJobResults),
  artifacts: many(researchArtifacts),
  requirements: many(requirements),
  fees: many(fees),
  deadlines: many(deadlines),
  changes: many(researchProgramChanges),
}));

export const researchJobResultsRelations = relations(researchJobResults, ({ one }) => ({
  job: one(researchJobs, {
    fields: [researchJobResults.jobId],
    references: [researchJobs.id],
  }),
  program: one(researchPrograms, {
    fields: [researchJobResults.programId],
    references: [researchPrograms.id],
  }),
}));

export const researchArtifactsRelations = relations(researchArtifacts, ({ one }) => ({
  job: one(researchJobs, {
    fields: [researchArtifacts.jobId],
    references: [researchJobs.id],
  }),
  program: one(researchPrograms, {
    fields: [researchArtifacts.programId],
    references: [researchPrograms.id],
  }),
}));

export const researchProgramChangesRelations = relations(researchProgramChanges, ({ one }) => ({
  job: one(researchJobs, {
    fields: [researchProgramChanges.jobId],
    references: [researchJobs.id],
  }),
  program: one(researchPrograms, {
    fields: [researchProgramChanges.programId],
    references: [researchPrograms.id],
  }),
}));

export const requirementsRelations = relations(requirements, ({ one }) => ({
  program: one(researchPrograms, {
    fields: [requirements.programId],
    references: [researchPrograms.id],
  }),
}));

export const feesRelations = relations(fees, ({ one }) => ({
  program: one(researchPrograms, {
    fields: [fees.programId],
    references: [researchPrograms.id],
  }),
}));

export const deadlinesRelations = relations(deadlines, ({ one }) => ({
  program: one(researchPrograms, {
    fields: [deadlines.programId],
    references: [researchPrograms.id],
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

// Research pipeline insert schemas
export const insertResearchJobSchema = createInsertSchema(researchJobs).omit({
  id: true,
  createdAt: true,
});

export const insertResearchProgramSchema = createInsertSchema(researchPrograms).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
});

export const insertResearchJobResultSchema = createInsertSchema(researchJobResults).omit({
  id: true,
});

export const insertResearchArtifactSchema = createInsertSchema(researchArtifacts).omit({
  id: true,
  createdAt: true,
});

export const insertResearchProgramChangeSchema = createInsertSchema(researchProgramChanges).omit({
  id: true,
  createdAt: true,
});

export const insertResearchScheduleSchema = createInsertSchema(researchSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

// Research pipeline types
export type ResearchJob = typeof researchJobs.$inferSelect;
export type InsertResearchJob = z.infer<typeof insertResearchJobSchema>;
export type ResearchProgram = typeof researchPrograms.$inferSelect;
export type InsertResearchProgram = z.infer<typeof insertResearchProgramSchema>;
export type ResearchJobResult = typeof researchJobResults.$inferSelect;
export type InsertResearchJobResult = z.infer<typeof insertResearchJobResultSchema>;
export type ResearchArtifact = typeof researchArtifacts.$inferSelect;
export type InsertResearchArtifact = z.infer<typeof insertResearchArtifactSchema>;
export type ResearchProgramChange = typeof researchProgramChanges.$inferSelect;
export type InsertResearchProgramChange = z.infer<typeof insertResearchProgramChangeSchema>;
export type ResearchSchedule = typeof researchSchedules.$inferSelect;
export type InsertResearchSchedule = z.infer<typeof insertResearchScheduleSchema>;
export type Requirement = typeof requirements.$inferSelect;
export type InsertRequirement = z.infer<typeof insertRequirementSchema>;
export type Fee = typeof fees.$inferSelect;
export type InsertFee = z.infer<typeof insertFeeSchema>;
export type Deadline = typeof deadlines.$inferSelect;
export type InsertDeadline = z.infer<typeof insertDeadlineSchema>;
