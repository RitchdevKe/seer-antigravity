const { Client } = require('pg');
const client = new Client({
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com', 
  port: 5432, 
  user: 'postgres', 
  password: 'SeerAdmin2026!bp6luu', 
  database: 'postgres', 
  ssl: { rejectUnauthorized: false }
});

client.connect().then(() => {
  return client.query(`
    ALTER TABLE ml_matrix_data ADD COLUMN IF NOT EXISTS matrix_type VARCHAR(50) DEFAULT 'basePatterns';
  `);
}).then(() => {
  console.log('Column added successfully');
  client.end();
}).catch(console.error);
