import { SERVICE_NAME } from '../constants';
import { getDatabaseStatus } from '../config/database';

export interface HealthCheckData {
  service: string;
  database: 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
}

export class HealthService {
  getStatus(): HealthCheckData {
    return {
      service: SERVICE_NAME,
      database: getDatabaseStatus(),
    };
  }
}

export const healthService = new HealthService();
