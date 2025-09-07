import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertComplianceRecordSchema = createInsertSchema(complianceRecords).omit({
  id: true,
  createdAt: true,
  verificationTimestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type InsertComplianceRecord = z.infer<typeof insertComplianceRecordSchema>;
