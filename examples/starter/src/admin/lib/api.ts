import { hc } from 'hono/client';
import type { AppType } from '../../server/app.js';

/** Typsicherer RPC-Client — kennt jede Route über AppType (siehe ARCHITECTURE §8). */
export const api = hc<AppType>('/');
