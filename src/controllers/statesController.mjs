import { runManual, runAssisted } from '../services/researchOrchestrator.mjs';
import { getStateWithResults, getSources, list } from '../services/stateRepository.mjs';
import dotenv from 'dotenv';

dotenv.config();

export async function upsertStateResults(req, res) {
  try {
    const { code } = req.params;
    const payload = req.body;
    
    if (!code || code.length !== 2) {
      return res.status(400).json({ 
        error: 'Invalid state code - must be 2 characters' 
      });
    }
    
    const result = await runManual(code.toUpperCase(), payload);
    
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error upserting state results:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function researchState(req, res) {
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
    
    const result = await runAssisted(code.toUpperCase());
    
    if (result.error) {
      const statusCode = result.code || 501;
      return res.status(statusCode).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error researching state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getState(req, res) {
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

export async function getStateSources(req, res) {
  try {
    const { code } = req.params;
    
    if (!code || code.length !== 2) {
      return res.status(400).json({ 
        error: 'Invalid state code - must be 2 characters' 
      });
    }
    
    const sources = await getSources(code.toUpperCase());
    res.json(sources);
  } catch (error) {
    console.error('Error getting state sources:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listStates(req, res) {
  try {
    const { q, missing } = req.query;
    
    const states = await list({ 
      q: q || undefined, 
      missing: missing === 'true' 
    });
    
    res.json(states);
  } catch (error) {
    console.error('Error listing states:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}