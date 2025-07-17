import knex from 'knex';
import path from 'path';
const knexConfig = require('../../../knexfile.js');

// In a real app, you would use an environment variable to select the config.
const environment: string = process.env.NODE_ENV || 'development';
const config = (knexConfig as any)[environment];

const db = knex(config);

export default db;