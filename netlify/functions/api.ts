import type { Config } from '@netlify/functions';
import { handleApi } from '../../shared/handlers';

export default async (request: Request): Promise<Response> => handleApi(request);

export const config: Config = {
  path: '/api/*',
};
