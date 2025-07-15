const bcrypt = require('bcrypt');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del()

  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('password', saltRounds);

  await knex('users').insert([
    {
      username: 'admin',
      password_hash: passwordHash,
      role: 'admin'
    },
    {
      username: 'staff',
      password_hash: passwordHash,
      role: 'staff'
    }
  ]);
};
