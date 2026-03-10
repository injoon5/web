import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DATABASE_URL } from '$env/static/private';
import * as schema from './schema.js';

const client = postgres(DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
