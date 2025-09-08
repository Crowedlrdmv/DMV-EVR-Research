import { validatePayload } from './sourcesValidator.mjs';
import { ensureState, upsertResults, replaceSources } from './stateRepository.mjs';
import dotenv from 'dotenv';

dotenv.config();

export async function runManual(code, payload) {
  // Validate payload
  const validation = validatePayload(payload);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  
  try {
    // Ensure state exists
    const state = await ensureState(code);
    
    // Upsert results
    const results = await upsertResults(state.id, payload);
    
    // Replace sources
    await replaceSources(state.id, payload);
    
    return {
      ok: true,
      code: state.code,
      last_verified_at: results.last_verified_at
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

export async function runAssisted(code) {
  if (process.env.ALLOW_WEB_AUTOMATION !== 'true') {
    return {
      error: 'Assisted mode disabled - set ALLOW_WEB_AUTOMATION=true to enable'
    };
  }
  
  // Stub implementation for assisted research
  return {
    error: 'Assisted research stub not implemented',
    note: 'This feature would use web automation to research official state DMV sources',
    code: 501
  };
}