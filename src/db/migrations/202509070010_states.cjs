exports.up = function(knex) {
  return knex.schema
    .createTable('states', table => {
      table.increments('id').primary();
      table.string('code', 2).unique().notNullable();
      table.text('name').notNullable();
      table.timestamps(true, true);
    })
    .createTable('state_results', table => {
      table.integer('state_id').primary().references('id').inTable('states').onDelete('CASCADE');
      table.string('evr_exists');
      table.text('evr_source_url');
      table.string('evr_mandatory_for_dealers');
      table.text('evr_requirement_source_url');
      table.string('digital_forms_allowed');
      table.text('digital_forms_source_url');
      table.text('ownership_transfer_process');
      table.text('ownership_transfer_source_url');
      table.string('typical_title_issuance_time');
      table.text('title_issuance_source_url');
      table.string('dealer_may_issue_temp_tag');
      table.text('temp_tag_issuance_source_url');
      table.text('temp_tag_issuance_method');
      table.text('temp_tag_issuance_method_source_url');
      table.integer('temp_tag_duration_days');
      table.text('temp_tag_duration_source_url');
      table.string('temp_tag_renewable');
      table.text('temp_tag_renewal_source_url');
      table.string('temp_tag_fee_who_pays');
      table.text('temp_tag_fee_source_url');
      table.timestamp('last_verified_at');
      table.timestamps(true, true);
    })
    .createTable('state_sources', table => {
      table.increments('id').primary();
      table.integer('state_id').references('id').inTable('states').onDelete('CASCADE');
      table.string('field_key').notNullable();
      table.text('url').notNullable();
      table.text('note');
      table.timestamps(true, true);
      table.index(['state_id', 'field_key']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('state_sources')
    .dropTableIfExists('state_results')
    .dropTableIfExists('states');
};