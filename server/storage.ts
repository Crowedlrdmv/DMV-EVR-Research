import { 
  users, 
  complianceRecords,
  type User, 
  type InsertUser,
  type ComplianceRecord,
  type InsertComplianceRecord 
} from "@shared/schema";
import { db } from "./db";
import { eq, count, gte, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Compliance records methods
  createComplianceRecord(record: InsertComplianceRecord): Promise<ComplianceRecord>;
  getComplianceRecords(limit?: number): Promise<ComplianceRecord[]>;
  getComplianceRecordById(id: string): Promise<ComplianceRecord | undefined>;
  updateComplianceRecord(id: string, updates: Partial<ComplianceRecord>): Promise<ComplianceRecord | undefined>;
  
  // Analytics methods
  getComplianceMetrics(): Promise<{
    totalRecords: number;
    complianceRate: number;
    failedVerifications: number;
    recentRecords: ComplianceRecord[];
  }>;
  
  getComplianceTrends(days: number): Promise<{
    date: string;
    compliantCount: number;
    totalCount: number;
  }[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createComplianceRecord(record: InsertComplianceRecord): Promise<ComplianceRecord> {
    const [created] = await db
      .insert(complianceRecords)
      .values(record)
      .returning();
    return created;
  }

  async getComplianceRecords(limit: number = 100): Promise<ComplianceRecord[]> {
    return await db
      .select()
      .from(complianceRecords)
      .orderBy(desc(complianceRecords.createdAt))
      .limit(limit);
  }

  async getComplianceRecordById(id: string): Promise<ComplianceRecord | undefined> {
    const [record] = await db
      .select()
      .from(complianceRecords)
      .where(eq(complianceRecords.id, id));
    return record || undefined;
  }

  async updateComplianceRecord(id: string, updates: Partial<ComplianceRecord>): Promise<ComplianceRecord | undefined> {
    const [updated] = await db
      .update(complianceRecords)
      .set(updates)
      .where(eq(complianceRecords.id, id))
      .returning();
    return updated || undefined;
  }

  async getComplianceMetrics() {
    const [totalResult] = await db.select({ count: count() }).from(complianceRecords);
    const totalRecords = totalResult.count;

    const [compliantResult] = await db
      .select({ count: count() })
      .from(complianceRecords)
      .where(eq(complianceRecords.complianceStatus, 'valid'));
    const compliantRecords = compliantResult.count;

    const [failedResult] = await db
      .select({ count: count() })
      .from(complianceRecords)
      .where(eq(complianceRecords.isVerified, false));
    const failedVerifications = failedResult.count;

    const recentRecords = await db
      .select()
      .from(complianceRecords)
      .orderBy(desc(complianceRecords.createdAt))
      .limit(10);

    return {
      totalRecords,
      complianceRate: totalRecords > 0 ? Math.round((compliantRecords / totalRecords) * 100) : 100,
      failedVerifications,
      recentRecords,
    };
  }

  async getComplianceTrends(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await db
      .select()
      .from(complianceRecords)
      .where(gte(complianceRecords.createdAt, startDate));

    // Group by date
    const trendsMap = new Map<string, { compliantCount: number; totalCount: number }>();
    
    records.forEach(record => {
      const date = record.createdAt.toISOString().split('T')[0];
      if (!trendsMap.has(date)) {
        trendsMap.set(date, { compliantCount: 0, totalCount: 0 });
      }
      const trend = trendsMap.get(date)!;
      trend.totalCount++;
      if (record.complianceStatus === 'valid') {
        trend.compliantCount++;
      }
    });

    return Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const storage = new DatabaseStorage();
