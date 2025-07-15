const knex = require('knex');
const path = require('path');
const knexConfig = require(path.join(__dirname, '..', '..', 'knexfile.js'));

// In a real app, you would use an environment variable to select the config.
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

const db = knex(config);

module.exports = db;
