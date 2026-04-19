import { init } from '@instantdb/admin';
import schema from '../../../../instant.schema.js';
import { INSTANT_APP_ID, INSTANT_APP_ADMIN_TOKEN } from '$env/static/private';

export const db = init({
  appId: INSTANT_APP_ID,
  adminToken: INSTANT_APP_ADMIN_TOKEN,
  schema,
});
