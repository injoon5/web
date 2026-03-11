import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// Disable prefetch as it's not supported on PlanetScale's serverless driver
const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
