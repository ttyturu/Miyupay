import { Pool, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.connect((err, _client, release) => {
  if (err) console.error('DB connection error:', err.message);
  else { console.log('Database connected'); release(); }
});

export const db = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> =>
    pool.query<T>(text, params),
  pool,
};
