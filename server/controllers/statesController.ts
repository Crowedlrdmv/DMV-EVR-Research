import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { 
  validateStatePayload,
  ensureState,
  upsertStateResults,
  replaceSources,
  getStateWithResults,
  getStateSources,
  listStates,
  StateResearchPayload
} from "../services/statesService";

export async function upsertStateResultsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { code } = req.params;
    const payload = req.body as StateResearchPayload;
    
    if (!code || code.length !== 2) {
      return res.status(400).json({ 
        error: 'Invalid state code - must be 2 characters' 
      });
    }
    
    // Validate payload
    const validation = validateStatePayload(payload);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }
    
    // Ensure state exists
    const state = await ensureState(code.toUpperCase());
    
    // Upsert results
    const results = await upsertStateResults(state.id, payload);
    
    // Replace sources
    await replaceSources(state.id, payload);
    
    res.json({
      ok: true,
      code: state.code,
      last_verified_at: results.lastVerifiedAt
    });
  } catch (error) {
    console.error('Error upserting state results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function researchStateHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { code } = req.params;
    
    if (!code || code.length !== 2) {
      return res.status(400).json({ 
        error: 'Invalid state code - must be 2 characters' 
      });
    }
    
    if (process.env.RESEARCH_MODE !== 'assisted') {
      return res.status(400).json({
        error: 'Assisted research not enabled',
        guidance: 'Set RESEARCH_MODE=assisted and ALLOW_WEB_AUTOMATION=true to enable automated research'
      });
    }
    
    if (process.env.ALLOW_WEB_AUTOMATION !== 'true') {
      return res.status(400).json({
        error: 'Web automation not allowed',
        guidance: 'Set ALLOW_WEB_AUTOMATION=true to enable automated research'
      });
    }
    
    // Stub implementation for assisted research
    res.status(501).json({
      error: 'Assisted research stub not implemented',
      note: 'This feature would use web automation to research official state DMV sources',
      code: 501
    });
  } catch (error) {
    console.error('Error researching state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStateHandler(req: Request, res: Response) {
  try {
    const { code } = req.params;
    
    if (!code || code.length !== 2) {
      return res.status(400).json({ 
        error: 'Invalid state code - must be 2 characters' 
      });
    }
    
    const state = await getStateWithResults(code.toUpperCase());
    
    if (!state) {
      return res.status(404).json({ 
        error: 'State not found' 
      });
    }
    
    res.json(state);
  } catch (error) {
    console.error('Error getting state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getStateSourcesHandler(req: Request, res: Response) {
  try {
    const { code } = req.params;
    
    if (!code || code.length !== 2) {
      return res.status(400).json({ 
        error: 'Invalid state code - must be 2 characters' 
      });
    }
    
    const sources = await getStateSources(code.toUpperCase());
    res.json(sources);
  } catch (error) {
    console.error('Error getting state sources:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listStatesHandler(req: Request, res: Response) {
  try {
    const { q, missing } = req.query;
    
    const states = await listStates({ 
      q: q as string || undefined, 
      missing: missing === 'true' 
    });
    
    res.json(states);
  } catch (error) {
    console.error('Error listing states:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}