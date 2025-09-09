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
      const { changeDetector } = await import("./services/research/changeDetector");
      
      // Get comprehensive analytics from real database data
      const [researchStats, jobs, changeStats] = await Promise.all([
        researchService.getResearchStats(),
        researchService.getJobs({}),
        changeDetector.getChangeStatistics({})
      ]);
      
      // Calculate job success rates from real data
      const successfulJobs = jobs.filter(j => j.status === 'success').length;
      const failedJobs = jobs.filter(j => j.status === 'error').length;
      const runningJobs = jobs.filter(j => j.status === 'running').length;
      const totalJobs = jobs.length;
      const successRate = totalJobs > 0 ? Math.round((successfulJobs / totalJobs) * 100) : 100;
      
      res.json({
        metrics: {
          totalRecords: metrics.totalRecords,
          complianceRate: `${metrics.complianceRate}%`,
          failedVerifications: metrics.failedVerifications,
          statePrograms: researchStats.totalPrograms,
          researchArtifacts: researchStats.totalArtifacts,
          statesCovered: Object.keys(researchStats.programsByState).length,
          // Enhanced job analytics from real data
          totalJobs,
          successfulJobs,
          failedJobs,
          runningJobs,
          jobSuccessRate: `${successRate}%`
        },
        research: {
          programsByState: researchStats.programsByState,
          totalPrograms: researchStats.totalPrograms,
          totalArtifacts: researchStats.totalArtifacts
        },
        changes: {
          totalChanges: changeStats.total,
          changesByType: changeStats.byType,
          newPrograms: changeStats.byType.new || 0,
          updatedPrograms: changeStats.byType.updated || 0,
          removedPrograms: changeStats.byType.removed || 0
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
      const { researchService } = await import("./services/research/researchService");
      
      // Get research analytics for enhanced trends
      const researchAnalytics = await researchService.getResearchAnalytics(days);
      
      // Format for Chart.js with enhanced data
      const chartData = {
        compliance: {
          labels: trends.map(t => new Date(t.date).toLocaleDateString()),
          data: trends.map(t => t.totalCount > 0 ? (t.compliantCount / t.totalCount) * 100 : 100)
        },
        volume: {
          labels: trends.slice(-7).map(t => new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' })),
          data: trends.slice(-7).map(t => t.totalCount)
        },
        research: {
          programDiscovery: {
            labels: researchAnalytics.programTrends.map((t: any) => new Date(t.date).toLocaleDateString()),
            data: researchAnalytics.programTrends.map((t: any) => t.count)
          },
          dataTypeCoverage: researchAnalytics.dataTypeCoverage,
          sourceValidation: researchAnalytics.sourceValidation
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
  // POST /api/research/jobs - Start new research job (matches expected contract)
  app.post("/api/research/jobs", requireBearerToken, async (req: AuthenticatedRequest, res) => {
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
      const { state, since, jobId } = req.query;
      
      const results = await researchService.getResearchResults({
        state: state as string,
        since: since as string,
        jobId: jobId as string
      });

      res.json({ results });
    } catch (error) {
      console.error("Error fetching research results:", error);
      res.status(500).json({ error: "Failed to fetch research results" });
    }
  });

  // Enhanced deltas endpoint with change detection
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

  // Change detection endpoint
  app.get("/api/research/changes", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { changeDetector } = await import("./services/research/changeDetector");
      const { jobId, since, changeType } = req.query;
      
      const filters: any = {};
      if (jobId) filters.jobId = jobId as string;
      if (since) filters.since = new Date(since as string);
      if (changeType) filters.changeType = changeType as string;
      
      const [changes, statistics] = await Promise.all([
        changeDetector.getChangesForJob(jobId as string || ''),
        changeDetector.getChangeStatistics(filters)
      ]);
      
      res.json({ changes, statistics });
    } catch (error) {
      console.error("Error fetching research changes:", error);
      res.status(500).json({ error: "Failed to fetch research changes" });
    }
  });

  // Research Schedule endpoints
  app.get("/api/research/schedules", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const schedules = await scheduleService.getSchedules();
      res.json(schedules);
    } catch (error) {
      console.error("Error fetching research schedules:", error);
      res.status(500).json({ error: "Failed to fetch research schedules" });
    }
  });

  app.post("/api/research/schedules", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const schedule = await scheduleService.createSchedule(req.body);
      res.status(201).json(schedule);
    } catch (error) {
      console.error("Error creating research schedule:", error);
      res.status(500).json({ error: "Failed to create research schedule" });
    }
  });

  app.get("/api/research/schedules/:id", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const schedule = await scheduleService.getSchedule(req.params.id);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error("Error fetching research schedule:", error);
      res.status(500).json({ error: "Failed to fetch research schedule" });
    }
  });

  app.put("/api/research/schedules/:id", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const schedule = await scheduleService.updateSchedule(req.params.id, req.body);
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      console.error("Error updating research schedule:", error);
      res.status(500).json({ error: "Failed to update research schedule" });
    }
  });

  app.delete("/api/research/schedules/:id", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const deleted = await scheduleService.deleteSchedule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      res.json({ message: "Schedule deleted successfully" });
    } catch (error) {
      console.error("Error deleting research schedule:", error);
      res.status(500).json({ error: "Failed to delete research schedule" });
    }
  });

  app.get("/api/research/schedules/upcoming", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const hours = parseInt(req.query.hours as string) || 24;
      const upcoming = await scheduleService.getUpcomingExecutions(hours);
      res.json(upcoming);
    } catch (error) {
      console.error("Error fetching upcoming executions:", error);
      res.status(500).json({ error: "Failed to fetch upcoming executions" });
    }
  });

  // Diagnostics and monitoring endpoints
  app.get("/api/diagnostics/health", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { diagnosticsService } = await import("./services/diagnostics/diagnosticsService");
      const health = await diagnosticsService.getSystemHealth();
      res.json(health);
    } catch (error) {
      console.error("Error fetching system health:", error);
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  app.get("/api/diagnostics/logs", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { diagnosticsService } = await import("./services/diagnostics/diagnosticsService");
      const { limit, level, component, since } = req.query;
      
      const options: any = {};
      if (limit) options.limit = parseInt(limit as string);
      if (level) options.level = level as string;
      if (component) options.component = component as string;
      if (since) options.since = new Date(since as string);
      
      const logs = diagnosticsService.getLogs(options);
      const stats = diagnosticsService.getLogStats();
      
      res.json({ logs, stats });
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.delete("/api/diagnostics/logs", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { diagnosticsService } = await import("./services/diagnostics/diagnosticsService");
      diagnosticsService.clearLogs();
      res.json({ message: "Logs cleared successfully" });
    } catch (error) {
      console.error("Error clearing logs:", error);
      res.status(500).json({ error: "Failed to clear logs" });
    }
  });

  app.get("/api/research/sources", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { researchService } = await import("./services/research/researchService");
      const sources = await researchService.getResearchSources();
      res.json({ sources });
    } catch (error) {
      console.error("Error fetching research sources:", error);
      res.status(500).json({ error: "Failed to fetch research sources" });
    }
  });

  app.get("/api/research/analytics", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { researchService } = await import("./services/research/researchService");
      const days = parseInt(req.query.days as string) || 30;
      const analytics = await researchService.getResearchAnalytics(days);
      res.json({ analytics });
    } catch (error) {
      console.error("Error fetching research analytics:", error);
      res.status(500).json({ error: "Failed to fetch research analytics" });
    }
  });

  // Diagnostics endpoints
  app.get("/api/diagnostics/health", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const startTime = Date.now();
      
      // Check database connectivity
      const dbStatus = await checkDatabaseHealth();
      
      // Check queue status
      const queueStatus = await checkQueueHealth();
      
      const responseTime = Date.now() - startTime;
      
      const health = {
        api: {
          status: "healthy",
          responseTime
        },
        database: dbStatus,
        queue: queueStatus,
        storage: {
          type: "PostgreSQL",
          usage: "Active"
        }
      };
      
      res.json(health);
    } catch (error) {
      console.error("Error fetching system health:", error);
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  app.get("/api/diagnostics/activity", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { researchService } = await import("./services/research/researchService");
      
      // Get recent jobs as activity
      const recentJobs = await researchService.getJobs({});
      
      const activity = recentJobs.slice(0, 20).map(job => ({
        timestamp: job.startedAt,
        type: 'job',
        level: job.status === 'error' ? 'error' : job.status === 'running' ? 'info' : 'success',
        message: `Research job ${job.status} for ${job.states.join(', ')}`,
        details: job.errorText || `Data types: ${job.dataTypes.join(', ')}`
      }));
      
      res.json(activity);
    } catch (error) {
      console.error("Error fetching system activity:", error);
      res.status(500).json({ error: "Failed to fetch system activity" });
    }
  });

  // Research schedule endpoints
  app.get("/api/research/schedules", optionalBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const schedules = await scheduleService.getSchedules();
      res.json({ schedules });
    } catch (error) {
      console.error("Error fetching research schedules:", error);
      res.status(500).json({ error: "Failed to fetch research schedules" });
    }
  });

  app.post("/api/research/schedules", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const schedule = await scheduleService.createSchedule(req.body);
      res.status(201).json({ schedule });
    } catch (error) {
      console.error("Error creating research schedule:", error);
      if (error instanceof Error && error.message.includes('validation')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to create research schedule" });
    }
  });

  app.put("/api/research/schedules/:id", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const schedule = await scheduleService.updateSchedule(req.params.id, req.body);
      
      if (!schedule) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      res.json({ schedule });
    } catch (error) {
      console.error("Error updating research schedule:", error);
      if (error instanceof Error && error.message.includes('validation')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update research schedule" });
    }
  });

  app.delete("/api/research/schedules/:id", requireBearerToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { scheduleService } = await import("./services/research/scheduleService");
      const deleted = await scheduleService.deleteSchedule(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Schedule not found" });
      }
      
      res.json({ message: "Schedule deleted successfully" });
    } catch (error) {
      console.error("Error deleting research schedule:", error);
      res.status(500).json({ error: "Failed to delete research schedule" });
    }
  });

  // Helper functions for diagnostics
  async function checkDatabaseHealth() {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
      return {
        status: "connected",
        connectionCount: 1
      };
    } catch (error) {
      return {
        status: "error",
        connectionCount: 0
      };
    }
  }

  async function checkQueueHealth() {
    try {
      const { queueConnection } = await import("./queue/connection");
      const queueStats = await queueConnection.getWaiting();
      const activeJobs = await queueConnection.getActive();
      const completedJobs = await queueConnection.getCompleted();
      const failedJobs = await queueConnection.getFailed();

      return {
        status: "connected", 
        type: "Database Fallback",
        jobs: {
          waiting: queueStats.length,
          active: activeJobs.length,
          completed: completedJobs.length,
          failed: failedJobs.length
        }
      };
    } catch (error) {
      return {
        status: "error",
        type: "Unavailable",
        jobs: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0
        }
      };
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
