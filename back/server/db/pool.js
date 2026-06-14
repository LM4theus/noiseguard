const { Pool } = require('pg');

// Conexão com o Postgres. No Docker, DATABASE_URL aponta para o serviço "db".
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://noiseguard:noiseguard@localhost:5432/noiseguard',
});

module.exports = pool;
