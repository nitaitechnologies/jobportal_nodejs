import { env } from '../config/env';
import { getDatabaseStatus } from '../config/database';

export interface HealthCheckData {
  service: string;
  database: 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
}

export class HealthService {
  getStatus(): HealthCheckData {
    return {
      service: env.serviceName,
      database: getDatabaseStatus(),
    };
  }
}

export const healthService = new HealthService();
