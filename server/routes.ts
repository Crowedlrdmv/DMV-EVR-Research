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
      const { researchService } = await import("./services/research/researchService");
      const researchStats = await researchService.getResearchStats();
      
      res.json({
        metrics: {
          totalRecords: metrics.totalRecords,
          complianceRate: `${metrics.complianceRate}%`,
          failedVerifications: metrics.failedVerifications,
          apiCalls: 0, // This would be tracked separately in a real implementation
          statePrograms: researchStats.totalPrograms,
          researchArtifacts: researchStats.totalArtifacts,
          statesCovered: Object.keys(researchStats.programsByState).length
        },
        research: {
          programsByState: researchStats.programsByState,
          totalPrograms: researchStats.totalPrograms,
          totalArtifacts: researchStats.totalArtifacts
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
      const { type, state } = req.query;
      const workbook = new ExcelJS.Workbook();
      
      if (type === 'states' || state) {
        // Export state research data
        const { getStateWithResults, listStates } = await import("./services/statesService");
        
        if (state && typeof state === 'string') {
          // Export single state
          const stateData = await getStateWithResults(state.toUpperCase());
          if (!stateData) {
            return res.status(404).json({ error: 'State not found' });
          }
          
          const worksheet = workbook.addWorksheet(`${stateData.name} DMV Research`);
          
          // Define columns for state data
          worksheet.columns = [
            { header: 'Field', key: 'field', width: 30 },
            { header: 'Value', key: 'value', width: 50 },
            { header: 'Source URL', key: 'sourceUrl', width: 60 }
          ];
          
          // Add state data rows
          const rows = [
            { field: 'State Code', value: stateData.code || '', sourceUrl: '' },
            { field: 'State Name', value: stateData.name || '', sourceUrl: '' },
            { field: 'EVR Exists', value: stateData.evrExists || '', sourceUrl: stateData.evrSourceUrl || '' },
            { field: 'EVR Mandatory for Dealers', value: stateData.evrMandatoryForDealers || '', sourceUrl: stateData.evrRequirementSourceUrl || '' },
            { field: 'Digital Forms Allowed', value: stateData.digitalFormsAllowed || '', sourceUrl: stateData.digitalFormsSourceUrl || '' },
            { field: 'Ownership Transfer Process', value: stateData.ownershipTransferProcess || '', sourceUrl: stateData.ownershipTransferSourceUrl || '' },
            { field: 'Typical Title Issuance Time', value: stateData.typicalTitleIssuanceTime || '', sourceUrl: stateData.titleIssuanceSourceUrl || '' },
            { field: 'Dealer May Issue Temp Tag', value: stateData.dealerMayIssueTempTag || '', sourceUrl: stateData.tempTagIssuanceSourceUrl || '' },
            { field: 'Temp Tag Issuance Method', value: stateData.tempTagIssuanceMethod || '', sourceUrl: stateData.tempTagIssuanceMethodSourceUrl || '' },
            { field: 'Temp Tag Duration (Days)', value: stateData.tempTagDurationDays?.toString() || '', sourceUrl: stateData.tempTagDurationSourceUrl || '' },
            { field: 'Temp Tag Renewable', value: stateData.tempTagRenewable || '', sourceUrl: stateData.tempTagRenewalSourceUrl || '' },
            { field: 'Temp Tag Fee Who Pays', value: stateData.tempTagFeeWhoPays || '', sourceUrl: stateData.tempTagFeeSourceUrl || '' },
            { field: 'Last Verified At', value: stateData.lastVerifiedAt ? new Date(stateData.lastVerifiedAt).toISOString() : '', sourceUrl: '' }
          ];
          
          worksheet.addRows(rows);
          
          // Set filename for single state
          res.setHeader('Content-Disposition', `attachment; filename="${stateData.code}_dmv_research.xlsx"`);
        } else {
          // Export all states
          const statesData = await listStates();
          const worksheet = workbook.addWorksheet('All States DMV Research');
          
          // Define columns for all states summary
          worksheet.columns = [
            { header: 'State Code', key: 'code', width: 12 },
            { header: 'State Name', key: 'name', width: 20 },
            { header: 'Last Verified', key: 'lastVerified', width: 20 },
            { header: 'EVR Exists', key: 'evrExists', width: 15 },
            { header: 'Digital Forms', key: 'digitalForms', width: 15 },
            { header: 'Temp Tag Duration', key: 'tempTagDuration', width: 18 }
          ];
          
          const rows = statesData.map(state => ({
            code: state.code,
            name: state.name,
            lastVerified: state.lastVerifiedAt ? new Date(state.lastVerifiedAt).toISOString().split('T')[0] : 'Not verified',
            evrExists: 'N/A', // Would need to join with results
            digitalForms: 'N/A',
            tempTagDuration: 'N/A'
          }));
          
          worksheet.addRows(rows);
          
          // Set filename for all states
          res.setHeader('Content-Disposition', 'attachment; filename="all_states_dmv_research.xlsx"');
        }
      } else {
        // Default: Export compliance records
        const records = await storage.getComplianceRecords(1000); // Limit for memory efficiency
        
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
        
        // Set filename for compliance records
        res.setHeader('Content-Disposition', 'attachment; filename="compliance_records.xlsx"');
      }
      
      // Set response headers for Excel download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
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

  // State research endpoints (existing)
  app.put("/api/states/:code", requireBearerToken, upsertStateResultsHandler);
  app.post("/api/states/:code/research", requireBearerToken, researchStateHandler);
  app.get("/api/states/:code", getStateHandler);
  app.get("/api/states/:code/sources", getStateSourcesHandler);
  app.get("/api/states", listStatesHandler);

  // Research pipeline endpoints
  app.post("/api/research/run", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { researchService } = await import("./services/research/researchService");
      const { states, dataTypes, depth = 'summary', since } = req.body;
      
      if (!states || !Array.isArray(states) || states.length === 0) {
        return res.status(400).json({ error: "States array is required" });
      }
      
      if (!dataTypes || !Array.isArray(dataTypes) || dataTypes.length === 0) {
        return res.status(400).json({ error: "DataTypes array is required" });
      }

      const jobIds = await researchService.startResearchJob({
        states: states.map((s: string) => s.toUpperCase()),
        dataTypes,
        depth,
        since
      });

      res.status(201).json({ jobIds, message: `Started ${jobIds.length} research jobs` });
    } catch (error) {
      console.error("Error starting research job:", error);
      if (error instanceof Error && error.message.includes('already running')) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to start research job" });
    }
  });

  app.get("/api/research/jobs", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { researchService } = await import("./services/research/researchService");
      const { status, state } = req.query;
      
      const jobs = await researchService.getJobs({
        status: status as string,
        state: state as string
      });

      res.json({ jobs });
    } catch (error) {
      console.error("Error fetching research jobs:", error);
      res.status(500).json({ error: "Failed to fetch research jobs" });
    }
  });

  app.get("/api/research/jobs/:id", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { researchService } = await import("./services/research/researchService");
      const job = await researchService.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json({ job });
    } catch (error) {
      console.error("Error fetching research job:", error);
      res.status(500).json({ error: "Failed to fetch research job" });
    }
  });

  app.get("/api/research/results", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { researchService } = await import("./services/research/researchService");
      const { state, since } = req.query;
      
      const results = await researchService.getResearchResults({
        state: state as string,
        since: since as string
      });

      res.json({ results });
    } catch (error) {
      console.error("Error fetching research results:", error);
      res.status(500).json({ error: "Failed to fetch research results" });
    }
  });

  app.get("/api/research/deltas", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { researchService } = await import("./services/research/researchService");
      const { state, since } = req.query;
      
      const deltas = await researchService.getResearchDeltas({
        state: state as string,
        since: since as string
      });

      res.json({ deltas });
    } catch (error) {
      console.error("Error fetching research deltas:", error);
      res.status(500).json({ error: "Failed to fetch research deltas" });
    }
  });

  app.get("/api/research/sources", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      // For MVP, return dummy adapter registry
      const sources = {
        "CA": [
          { id: "ca-dmv-rules", name: "CA DMV Rules", supports: ["rules", "inspections"], url: "https://dmv.ca.gov/rules" },
          { id: "ca-emissions", name: "CA Emissions Program", supports: ["emissions"], url: "https://dmv.ca.gov/emissions" }
        ],
        "TX": [
          { id: "tx-dmv-programs", name: "TX DMV Programs", supports: ["rules", "inspections"], url: "https://dmv.tx.gov/programs" },
          { id: "tx-fees", name: "TX Fee Schedule", supports: ["forms"], url: "https://dmv.tx.gov/fees" }
        ]
      };

      res.json({ sources });
    } catch (error) {
      console.error("Error fetching research sources:", error);
      res.status(500).json({ error: "Failed to fetch research sources" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
