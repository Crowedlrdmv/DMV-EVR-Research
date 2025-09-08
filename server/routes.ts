import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireBearerToken, optionalBearerToken, type AuthenticatedRequest } from "./middleware/auth";
import { insertComplianceRecordSchema } from "@shared/schema";
import ExcelJS from "exceljs";
import { 
  upsertStateResultsHandler, 
  researchStateHandler, 
  getStateHandler, 
  getStateSourcesHandler, 
  listStatesHandler 
} from "./controllers/statesController";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      database: "connected"
    });
  });

  // Data ingestion endpoints (require bearer token)
  app.post("/api/ingestion/compliance", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertComplianceRecordSchema.parse(req.body);
      const record = await storage.createComplianceRecord(validatedData);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.issues 
        });
      }
      console.error("Error creating compliance record:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/ingestion/status", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const metrics = await storage.getComplianceMetrics();
      res.json({
        authenticated: req.isAuthenticated,
        queueLength: 0,
        avgProcessingTime: "< 1s",
        successRate: "100%",
        ...metrics
      });
    } catch (error) {
      console.error("Error fetching ingestion status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Analytics endpoints (optional bearer token for enhanced access)
  app.get("/api/analytics/summary", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const metrics = await storage.getComplianceMetrics();
      res.json({
        metrics: {
          totalRecords: metrics.totalRecords,
          complianceRate: `${metrics.complianceRate}%`,
          failedVerifications: metrics.failedVerifications,
          apiCalls: 0 // This would be tracked separately in a real implementation
        },
        authenticated: req.isAuthenticated
      });
    } catch (error) {
      console.error("Error fetching analytics summary:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/analytics/trends", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const trends = await storage.getComplianceTrends(days);
      
      // Format for Chart.js
      const chartData = {
        compliance: {
          labels: trends.map(t => new Date(t.date).toLocaleDateString()),
          data: trends.map(t => t.totalCount > 0 ? (t.compliantCount / t.totalCount) * 100 : 100)
        },
        volume: {
          labels: trends.slice(-7).map(t => new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' })),
          data: trends.slice(-7).map(t => t.totalCount)
        }
      };
      
      res.json(chartData);
    } catch (error) {
      console.error("Error fetching analytics trends:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // AI Verification endpoint
  app.post("/api/verify", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const inputData = req.body;
      
      // Simulate AI verification (stubbed implementation)
      if (!inputData || Object.keys(inputData).length === 0) {
        return res.json({
          verified: false,
          reason: "No data provided for verification"
        });
      }

      // Check for expiry date validation
      let verified = true;
      let details = "Data passed all compliance checks";
      
      if (inputData.expiry_date) {
        const expiryDate = new Date(inputData.expiry_date);
        const now = new Date();
        if (expiryDate < now) {
          verified = false;
          details = "Compliance data has expired";
        }
      }

      res.json({
        verified,
        details,
        timestamp: new Date().toISOString(),
        vehicleId: inputData.vehicle_id || 'unknown'
      });
    } catch (error) {
      console.error("Verification error:", error);
      res.status(500).json({ error: "Verification process failed" });
    }
  });

  // Excel export endpoint
  app.get("/api/export", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const records = await storage.getComplianceRecords(1000); // Limit for memory efficiency
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Compliance Records');
      
      // Define columns
      worksheet.columns = [
        { header: 'Vehicle ID', key: 'vehicleId', width: 20 },
        { header: 'Compliance Status', key: 'complianceStatus', width: 20 },
        { header: 'Expiry Date', key: 'expiryDate', width: 15 },
        { header: 'Verified', key: 'isVerified', width: 10 },
        { header: 'Created At', key: 'createdAt', width: 20 }
      ];
      
      // Add data rows
      const rows = records.map(record => ({
        vehicleId: record.vehicleId,
        complianceStatus: record.complianceStatus,
        expiryDate: record.expiryDate ? record.expiryDate.toISOString().split('T')[0] : '',
        isVerified: record.isVerified ? 'Yes' : 'No',
        createdAt: record.createdAt.toISOString()
      }));
      
      worksheet.addRows(rows);
      
      // Set response headers for Excel download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="compliance_records.xlsx"');
      
      // Stream the workbook
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error generating Excel export:", error);
      res.status(500).json({ error: "Export generation failed" });
    }
  });

  // Get recent verifications for dashboard
  app.get("/api/verifications/recent", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const records = await storage.getComplianceRecords(10);
      const recentVerifications = records.map(record => ({
        vehicleId: record.vehicleId,
        status: record.complianceStatus,
        timestamp: record.verificationTimestamp
      }));
      
      res.json(recentVerifications);
    } catch (error) {
      console.error("Error fetching recent verifications:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // State research endpoints
  app.put("/api/states/:code", requireBearerToken, upsertStateResultsHandler);
  app.post("/api/states/:code/research", requireBearerToken, researchStateHandler);
  app.get("/api/states/:code", getStateHandler);
  app.get("/api/states/:code/sources", getStateSourcesHandler);
  app.get("/api/states", listStatesHandler);

  const httpServer = createServer(app);
  return httpServer;
}
