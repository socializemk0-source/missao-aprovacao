// src/db/index.js
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      // O Postgres do Supabase (conexão direta OU pooler) exige SSL — sem
      // isto a conexão é recusada de cara. rejectUnauthorized:false porque
      // o certificado da Supabase não é validado pela CA padrão do Node
      // (mesma configuração usada para RDS/Heroku Postgres/etc.).
      ssl: { rejectUnauthorized: false },
      // Baixo de propósito: cada invocação serverless da Vercel roda seu
      // próprio processo com seu próprio pool. Com várias invocações
      // simultâneas, pools "grandes" (ex.: 10) por instância multiplicam e
      // esgotam rápido o limite de conexões do Postgres/pooler do Supabase.
      max: 3,
      connectionTimeoutMillis: 15000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
