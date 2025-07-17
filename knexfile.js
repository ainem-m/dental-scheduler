// Update this file with your database configuration.

module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: './data/dev.sqlite3'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './server/db/migrations'
    },
    seeds: {
      directory: './server/db/seeds'
    }
  },

  test: {
    client: 'better-sqlite3',
    connection: {
      filename: ':memory:' // Use in-memory database for tests
    },
    useNullAsDefault: true,
    migrations: {
      directory: './server/db/migrations'
    },
    seeds: {
      directory: './server/db/seeds'
    }
  },

  production: {
    client: 'better-sqlite3',
    connection: {
      filename: './data/prod.sqlite3'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './server/db/migrations'
    },
    seeds: {
      directory: './server/db/seeds'
    }
  }
};
