/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('holidays', (table) => {
    table.increments('id').primary();
    table.string('type').notNullable(); // 'SPECIFIC_DATE' or 'RECURRING_DAY'
    table.string('date'); // 'YYYY-MM-DD' for SPECIFIC_DATE
    table.integer('day_of_week'); // 0-6 for RECURRING_DAY
    table.string('name');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('holidays');
};