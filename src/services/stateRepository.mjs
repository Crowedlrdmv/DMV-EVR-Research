import knex from 'knex';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Knex configuration
const knexConfig = {
  client: 'sqlite3',
  connection: {
    filename: process.env.DATABASE_URL?.replace('file:', '') || './data/app.sqlite'
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, '../db/migrations')
  }
};

const db = knex(knexConfig);

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
};

export async function ensureState(code) {
  const upperCode = code.toUpperCase();
  
  if (!stateNames[upperCode]) {
    throw new Error(`Invalid state code: ${code}`);
  }
  
  const existing = await db('states').where('code', upperCode).first();
  
  if (existing) {
    return existing;
  }
  
  const [state] = await db('states')
    .insert({
      code: upperCode,
      name: stateNames[upperCode]
    })
    .returning(['id', 'code', 'name']);
    
  return state;
}

export async function upsertResults(stateId, payload) {
  const existing = await db('state_results').where('state_id', stateId).first();
  
  const data = {
    state_id: stateId,
    evr_exists: payload.evr_exists,
    evr_source_url: payload.evr_source_url,
    evr_mandatory_for_dealers: payload.evr_mandatory_for_dealers,
    evr_requirement_source_url: payload.evr_requirement_source_url,
    digital_forms_allowed: payload.digital_forms_allowed,
    digital_forms_source_url: payload.digital_forms_source_url,
    ownership_transfer_process: payload.ownership_transfer_process,
    ownership_transfer_source_url: payload.ownership_transfer_source_url,
    typical_title_issuance_time: payload.typical_title_issuance_time,
    title_issuance_source_url: payload.title_issuance_source_url,
    dealer_may_issue_temp_tag: payload.dealer_may_issue_temp_tag,
    temp_tag_issuance_source_url: payload.temp_tag_issuance_source_url,
    temp_tag_issuance_method: payload.temp_tag_issuance_method,
    temp_tag_issuance_method_source_url: payload.temp_tag_issuance_method_source_url,
    temp_tag_duration_days: payload.temp_tag_duration_days,
    temp_tag_duration_source_url: payload.temp_tag_duration_source_url,
    temp_tag_renewable: payload.temp_tag_renewable,
    temp_tag_renewal_source_url: payload.temp_tag_renewal_source_url,
    temp_tag_fee_who_pays: payload.temp_tag_fee_who_pays,
    temp_tag_fee_source_url: payload.temp_tag_fee_source_url,
    last_verified_at: new Date()
  };
  
  if (existing) {
    await db('state_results').where('state_id', stateId).update(data);
  } else {
    await db('state_results').insert(data);
  }
  
  return data;
}

export async function replaceSources(stateId, payload) {
  // Clear existing sources for this state
  await db('state_sources').where('state_id', stateId).del();
  
  // Insert new sources for URL fields
  const urlFields = Object.keys(payload).filter(key => key.endsWith('_url'));
  const sources = [];
  
  for (const field of urlFields) {
    const url = payload[field];
    if (url) {
      sources.push({
        state_id: stateId,
        field_key: field,
        url: url,
        note: null
      });
    }
  }
  
  if (sources.length > 0) {
    await db('state_sources').insert(sources);
  }
  
  return sources;
}

export async function getStateWithResults(code) {
  const upperCode = code.toUpperCase();
  
  const state = await db('states')
    .leftJoin('state_results', 'states.id', 'state_results.state_id')
    .where('states.code', upperCode)
    .first();
    
  if (!state) {
    return null;
  }
  
  // Get sources for this state
  const sources = await db('state_sources')
    .where('state_id', state.id)
    .select('field_key', 'url', 'note');
    
  // Group sources by field_key
  const sourcesMap = {};
  sources.forEach(source => {
    if (!sourcesMap[source.field_key]) {
      sourcesMap[source.field_key] = [];
    }
    sourcesMap[source.field_key].push({
      url: source.url,
      note: source.note
    });
  });
  
  return {
    ...state,
    sources: sourcesMap
  };
}

export async function getSources(code) {
  const upperCode = code.toUpperCase();
  
  const state = await db('states').where('code', upperCode).first();
  if (!state) {
    return [];
  }
  
  return await db('state_sources')
    .where('state_id', state.id)
    .select('field_key', 'url', 'note');
}

export async function list({ q, missing } = {}) {
  let query = db('states')
    .leftJoin('state_results', 'states.id', 'state_results.state_id')
    .select('states.*', 'state_results.last_verified_at');
    
  if (q) {
    query = query.where(function() {
      this.where('states.name', 'like', `%${q}%`)
          .orWhere('states.code', 'like', `%${q}%`);
    });
  }
  
  if (missing) {
    query = query.where(function() {
      this.whereNull('state_results.state_id')
          .orWhereNull('state_results.evr_exists')
          .orWhereNull('state_results.evr_source_url');
    });
  }
  
  return await query.orderBy('states.name');
}