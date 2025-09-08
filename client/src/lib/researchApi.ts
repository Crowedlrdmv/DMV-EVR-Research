import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

// Types based on the specification
export type ResearchDepth = 'summary' | 'full';

export interface ResearchRunPayload {
  states: string[];
  dataTypes: Array<'rules'|'emissions'|'inspections'|'bulletins'|'forms'>;
  depth: ResearchDepth;
}

export interface ResearchJob {
  id: string;
  status: 'queued'|'running'|'success'|'error';
  states: string[];
  dataTypes: string[];
  depth: ResearchDepth;
  startedAt: string;
  finishedAt?: string;
  stats?: { artifacts?: number; programs?: number };
  errorText?: string;
  logs?: string[];
}

export interface ResearchProgram {
  id: string;
  state: string;         // 'CA'
  type: 'rules'|'emissions'|'inspections'|'bulletins'|'forms';
  title: string;
  url: string;
  summary?: string;
  lastUpdated: string;
  createdAt: string;
}

export interface ResearchSummary {
  totalPrograms: number;
  statesCovered: number;
  totalArtifacts: number;
}

// Utility function to safely extract arrays from API responses
const asArray = <T,>(value: any, key?: string): T[] => {
  if (Array.isArray(value)) return value;
  if (key && Array.isArray(value?.[key])) return value[key];
  return [];
};

// Fetch wrapper with error handling, timeout, and retry logic
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 2): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Retry on 429 or 5xx errors
    if (!response.ok && retries > 0 && (response.status === 429 || response.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      return fetchWithRetry(url, options, retries - 1);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Bearer token for authentication - in a real app this would come from auth context
const getBearerToken = (): string => {
  // For demo purposes, using a placeholder token
  // In production, this would come from auth context/localStorage
  return "demo-research-token-12345";
};

// Environment flag check
const isResearchRunEnabled = (): boolean => {
  return import.meta.env.VITE_RESEARCH_RUN_ENABLED !== 'false';
};

// API Client Functions
export const researchApi = {
  // Run research job
  runResearch: async (payload: ResearchRunPayload): Promise<{ jobIds: string[]; message: string }> => {
    if (!isResearchRunEnabled()) {
      toast({
        title: "ℹ️ Research Disabled",
        description: "Run disabled in preview. Results still visible below.",
      });
      throw new Error('Research run is disabled in this environment');
    }
    
    const response = await apiRequest('POST', '/api/research/run', payload, getBearerToken());
    return response.json();
  },

  // Get all research jobs
  getJobs: async (): Promise<ResearchJob[]> => {
    try {
      const response = await fetchWithRetry('/api/research/jobs');
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      }
      const data = await response.json();
      return asArray<ResearchJob>(data, 'jobs');
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "⚠️ Error Loading Jobs",
        description: "Failed to load research jobs. Please try again.",
        variant: "destructive",
      });
      return [];
    }
  },

  // Get specific research job
  getJob: async (jobId: string): Promise<ResearchJob | null> => {
    try {
      const response = await fetchWithRetry(`/api/research/jobs/${jobId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch job ${jobId}: ${response.statusText}`);
      }
      const data = await response.json();
      return data.job || null;
    } catch (error) {
      console.error(`Error fetching job ${jobId}:`, error);
      return null;
    }
  },

  // Get research results
  getResults: async (params?: { state?: string; type?: string }): Promise<ResearchProgram[]> => {
    try {
      const searchParams = new URLSearchParams();
      if (params?.state) searchParams.set('state', params.state);
      if (params?.type) searchParams.set('type', params.type);
      
      const url = `/api/research/results${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const response = await fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`);
      }
      const data = await response.json();
      return asArray<ResearchProgram>(data, 'results');
    } catch (error) {
      console.error('Error fetching results:', error);
      toast({
        title: "⚠️ Error Loading Results",
        description: "Failed to load research results. Please try again.",
        variant: "destructive",
      });
      return [];
    }
  },

  // Get research deltas
  getDeltas: async (params?: { state?: string; since?: string }): Promise<any[]> => {
    try {
      const searchParams = new URLSearchParams();
      if (params?.state) searchParams.set('state', params.state);
      if (params?.since) searchParams.set('since', params.since);
      
      const url = `/api/research/deltas${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const response = await fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch deltas: ${response.statusText}`);
      }
      const data = await response.json();
      return asArray<any>(data, 'deltas');
    } catch (error) {
      console.error('Error fetching deltas:', error);
      return [];
    }
  },

  // Get research summary
  getSummary: async (): Promise<ResearchSummary> => {
    try {
      const results = await researchApi.getResults();
      const uniqueStates = new Set(results.map(r => r.state));
      
      return {
        totalPrograms: results.length,
        statesCovered: uniqueStates.size,
        totalArtifacts: results.length // Approximate - would be more detailed in real implementation
      };
    } catch (error) {
      // Return default values if API fails
      return {
        totalPrograms: 0,
        statesCovered: 0,
        totalArtifacts: 0
      };
    }
  },

  // Check if duplicate job is running
  checkForDuplicateJob: async (states: string[], dataTypes: string[]): Promise<boolean> => {
    try {
      const jobs = await researchApi.getJobs();
      const safeJobs = Array.isArray(jobs) ? jobs : [];
      return safeJobs.some(job => 
        (job.status === 'queued' || job.status === 'running') &&
        (Array.isArray(job.states) ? job.states.slice().sort().join(',') : '') === states.slice().sort().join(',') &&
        (Array.isArray(job.dataTypes) ? job.dataTypes.slice().sort().join(',') : '') === dataTypes.slice().sort().join(',')
      );
    } catch (error) {
      console.error('Error checking for duplicate jobs:', error);
      return false;
    }
  }
};

// Utility functions
export const formatJobDuration = (startedAt: string, finishedAt?: string): string => {
  const start = new Date(startedAt);
  const end = finishedAt ? new Date(finishedAt) : new Date();
  const durationMs = end.getTime() - start.getTime();
  
  if (durationMs < 1000) return "< 1s";
  if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
  if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
  return `${Math.round(durationMs / 3600000)}h`;
};

export const getStatusColor = (status: ResearchJob['status']): string => {
  switch (status) {
    case 'queued': return 'bg-yellow-100 text-yellow-800';
    case 'running': return 'bg-blue-100 text-blue-800';
    case 'success': return 'bg-green-100 text-green-800';
    case 'error': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getTypeColor = (type: ResearchProgram['type']): string => {
  switch (type) {
    case 'rules': return 'bg-blue-100 text-blue-800';
    case 'emissions': return 'bg-green-100 text-green-800';
    case 'inspections': return 'bg-purple-100 text-purple-800';
    case 'bulletins': return 'bg-orange-100 text-orange-800';
    case 'forms': return 'bg-pink-100 text-pink-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};