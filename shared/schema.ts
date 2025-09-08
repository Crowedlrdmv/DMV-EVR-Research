import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, serial, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
