import { db } from "../db";
import { states, stateResults, stateSources } from "@shared/schema";
import { eq } from "drizzle-orm";

// Static map of US states and territories
const stateNames = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
} as const;

// Official domains validation
const officialDomains = new Set(['.gov', '.mil', '.us']);

export function isOfficialSource(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    for (const domain of Array.from(officialDomains)) {
      if (hostname.endsWith(domain)) return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

export const fieldKeys = new Set([
  'state',
  'evr_exists',
  'evr_source_url',
  'evr_mandatory_for_dealers',
  'evr_requirement_source_url',
  'digital_forms_allowed',
  'digital_forms_source_url',
  'ownership_transfer_process',
  'ownership_transfer_source_url',
  'typical_title_issuance_time',
  'title_issuance_source_url',
  'dealer_may_issue_temp_tag',
  'temp_tag_issuance_source_url',
  'temp_tag_issuance_method',
  'temp_tag_issuance_method_source_url',
  'temp_tag_duration_days',
  'temp_tag_duration_source_url',
  'temp_tag_renewable',
  'temp_tag_renewal_source_url',
  'temp_tag_fee_who_pays',
  'temp_tag_fee_source_url'
]);

export interface StateResearchPayload {
  state: string;
  evr_exists?: string | null;
  evr_source_url?: string | null;
  evr_mandatory_for_dealers?: string | null;
  evr_requirement_source_url?: string | null;
  digital_forms_allowed?: string | null;
  digital_forms_source_url?: string | null;
  ownership_transfer_process?: string | null;
  ownership_transfer_source_url?: string | null;
  typical_title_issuance_time?: string | null;
  title_issuance_source_url?: string | null;
  dealer_may_issue_temp_tag?: string | null;
  temp_tag_issuance_source_url?: string | null;
  temp_tag_issuance_method?: string | null;
  temp_tag_issuance_method_source_url?: string | null;
  temp_tag_duration_days?: number | null;
  temp_tag_duration_source_url?: string | null;
  temp_tag_renewable?: string | null;
  temp_tag_renewal_source_url?: string | null;
  temp_tag_fee_who_pays?: string | null;
  temp_tag_fee_source_url?: string | null;
}

export function validateStatePayload(payload: any): { ok: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Payload must be an object' };
  }
  
  // Check all required fields are present
  for (const key of Array.from(fieldKeys)) {
    if (!(key in payload)) {
      return { ok: false, error: `Missing required field: ${key}` };
    }
  }
  
  // Validate types
  const stringFields = Array.from(fieldKeys).filter(key => key !== 'temp_tag_duration_days');
  const intFields = ['temp_tag_duration_days'];
  
  for (const field of stringFields) {
    if (payload[field] !== null && typeof payload[field] !== 'string') {
      return { ok: false, error: `Field ${field} must be a string or null` };
    }
  }
  
  for (const field of intFields) {
    if (payload[field] !== null && !Number.isInteger(payload[field])) {
      return { ok: false, error: `Field ${field} must be an integer or null` };
    }
  }
  
  // Validate all URL fields are official sources
  const urlFields = Array.from(fieldKeys).filter(key => key.endsWith('_url'));
  
  for (const field of urlFields) {
    const url = payload[field];
    if (url && !isOfficialSource(url)) {
      return { ok: false, error: `Field ${field} must be from an official source (.gov, .mil, .us)` };
    }
  }
  
  return { ok: true };
}

export async function ensureState(code: string) {
  const upperCode = code.toUpperCase();
  
  if (!stateNames[upperCode as keyof typeof stateNames]) {
    throw new Error(`Invalid state code: ${code}`);
  }
  
  const existing = await db
    .select()
    .from(states)
    .where(eq(states.code, upperCode))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  const [state] = await db
    .insert(states)
    .values({
      code: upperCode,
      name: stateNames[upperCode as keyof typeof stateNames]
    })
    .returning();
    
  return state;
}

export async function upsertStateResults(stateId: number, payload: StateResearchPayload) {
  const existing = await db
    .select()
    .from(stateResults)
    .where(eq(stateResults.stateId, stateId))
    .limit(1);
  
  const data = {
    stateId,
    evrExists: payload.evr_exists,
    evrSourceUrl: payload.evr_source_url,
    evrMandatoryForDealers: payload.evr_mandatory_for_dealers,
    evrRequirementSourceUrl: payload.evr_requirement_source_url,
    digitalFormsAllowed: payload.digital_forms_allowed,
    digitalFormsSourceUrl: payload.digital_forms_source_url,
    ownershipTransferProcess: payload.ownership_transfer_process,
    ownershipTransferSourceUrl: payload.ownership_transfer_source_url,
    typicalTitleIssuanceTime: payload.typical_title_issuance_time,
    titleIssuanceSourceUrl: payload.title_issuance_source_url,
    dealerMayIssueTempTag: payload.dealer_may_issue_temp_tag,
    tempTagIssuanceSourceUrl: payload.temp_tag_issuance_source_url,
    tempTagIssuanceMethod: payload.temp_tag_issuance_method,
    tempTagIssuanceMethodSourceUrl: payload.temp_tag_issuance_method_source_url,
    tempTagDurationDays: payload.temp_tag_duration_days,
    tempTagDurationSourceUrl: payload.temp_tag_duration_source_url,
    tempTagRenewable: payload.temp_tag_renewable,
    tempTagRenewalSourceUrl: payload.temp_tag_renewal_source_url,
    tempTagFeeWhoPays: payload.temp_tag_fee_who_pays,
    tempTagFeeSourceUrl: payload.temp_tag_fee_source_url,
    lastVerifiedAt: new Date()
  };
  
  if (existing.length > 0) {
    await db
      .update(stateResults)
      .set(data)
      .where(eq(stateResults.stateId, stateId));
  } else {
    await db.insert(stateResults).values(data);
  }
  
  return data;
}

export async function replaceSources(stateId: number, payload: StateResearchPayload) {
  // Clear existing sources for this state
  await db.delete(stateSources).where(eq(stateSources.stateId, stateId));
  
  // Insert new sources for URL fields
  const urlFields = Object.keys(payload).filter(key => key.endsWith('_url'));
  const sources = [];
  
  for (const field of urlFields) {
    const url = payload[field as keyof StateResearchPayload] as string;
    if (url) {
      sources.push({
        stateId: stateId,
        fieldKey: field,
        url: url,
        note: null
      });
    }
  }
  
  if (sources.length > 0) {
    await db.insert(stateSources).values(sources);
  }
  
  return sources;
}

export async function getStateWithResults(code: string) {
  const upperCode = code.toUpperCase();
  
  const stateData = await db
    .select()
    .from(states)
    .leftJoin(stateResults, eq(states.id, stateResults.stateId))
    .where(eq(states.code, upperCode))
    .limit(1);
    
  if (stateData.length === 0) {
    return null;
  }
  
  const state = stateData[0];
  
  // Get sources for this state
  const sources = await db
    .select()
    .from(stateSources)
    .where(eq(stateSources.stateId, state.states.id));
    
  // Group sources by field_key
  const sourcesMap: Record<string, Array<{ url: string; note: string | null }>> = {};
  sources.forEach(source => {
    if (!sourcesMap[source.fieldKey]) {
      sourcesMap[source.fieldKey] = [];
    }
    sourcesMap[source.fieldKey].push({
      url: source.url,
      note: source.note
    });
  });
  
  return {
    ...state.states,
    ...state.state_results,
    sources: sourcesMap
  };
}

export async function getStateSources(code: string) {
  const upperCode = code.toUpperCase();
  
  const state = await db
    .select()
    .from(states)
    .where(eq(states.code, upperCode))
    .limit(1);
    
  if (state.length === 0) {
    return [];
  }
  
  return await db
    .select({
      fieldKey: stateSources.fieldKey,
      url: stateSources.url,
      note: stateSources.note
    })
    .from(stateSources)
    .where(eq(stateSources.stateId, state[0].id));
}

export async function listStates(options: { q?: string; missing?: boolean } = {}) {
  let query = db
    .select({
      id: states.id,
      code: states.code,
      name: states.name,
      createdAt: states.createdAt,
      lastVerifiedAt: stateResults.lastVerifiedAt
    })
    .from(states)
    .leftJoin(stateResults, eq(states.id, stateResults.stateId));
    
  // Note: Drizzle doesn't have the same query builder flexibility as Knex
  // For complex filtering, we'd need to build this differently or use raw SQL
  
  const results = await query;
  
  // Apply filters in memory (not ideal for large datasets)
  let filtered = results;
  
  if (options.q) {
    const searchTerm = options.q.toLowerCase();
    filtered = filtered.filter(state => 
      state.name.toLowerCase().includes(searchTerm) ||
      state.code.toLowerCase().includes(searchTerm)
    );
  }
  
  if (options.missing) {
    filtered = filtered.filter(state => 
      !state.lastVerifiedAt
    );
  }
  
  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}