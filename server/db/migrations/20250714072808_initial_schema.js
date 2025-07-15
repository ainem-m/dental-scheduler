/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('users', function (table) {
      table.increments('id');
      table.string('username', 255).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.string('role', 50).defaultTo('staff');
    })
    .createTable('reservations', function (table) {
      table.increments('id');
      table.date('date').notNullable();
      table.integer('time_min').notNullable();
      table.integer('column_index').notNullable();
      table.string('patient_name', 255);
      table.string('handwriting', 255);
      table.timestamps(true, true);
      table.unique(['date', 'time_min', 'column_index']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTable('reservations')
    .dropTable('users');
};