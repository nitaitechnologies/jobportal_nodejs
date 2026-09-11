import type { OpenAPIV3 } from 'openapi-types';
import { idParam, jsonBody, op, pageParams } from '../helpers';

const obj = { type: 'object' as const, additionalProperties: true };

export const sharedPaths: OpenAPIV3.PathsObject = {
  '/api/v1/notifications': {
    get: op({
      operationId: 'listNotifications',
      tags: ['Notifications'],
      summary: 'List own notifications',
      description: 'Candidate or employer. Scoped to JWT userId → recipientId. Requires active account.',
      parameters: [
        ...pageParams(),
        { name: 'unreadOnly', in: 'query', schema: { type: 'boolean' } },
      ],
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/notifications/unread-count': {
    get: op({
      operationId: 'getUnreadNotificationCount',
      tags: ['Notifications'],
      summary: 'Unread notification count',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/notifications/read-all': {
    patch: op({
      operationId: 'markAllNotificationsRead',
      tags: ['Notifications'],
      summary: 'Mark all notifications read',
      data: obj,
      errors: ['401', '403'],
    }),
  },
  '/api/v1/notifications/{id}': {
    get: op({
      operationId: 'getNotification',
      tags: ['Notifications'],
      summary: 'Get notification',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
    delete: op({
      operationId: 'deleteNotification',
      tags: ['Notifications'],
      summary: 'Delete notification',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/notifications/{id}/read': {
    patch: op({
      operationId: 'markNotificationRead',
      tags: ['Notifications'],
      summary: 'Mark notification read',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
  '/api/v1/notifications/{id}/unread': {
    patch: op({
      operationId: 'markNotificationUnread',
      tags: ['Notifications'],
      summary: 'Mark notification unread',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },

  '/api/v1/reports': {
    post: op({
      operationId: 'createReport',
      tags: ['Reports'],
      summary: 'Create safety report',
      requestBody: jsonBody({ $ref: '#/components/schemas/ReportCreateRequest' }),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/reports/my': {
    get: op({
      operationId: 'listMyReports',
      tags: ['Reports'],
      summary: 'List own reports',
      parameters: pageParams(),
      data: obj,
      errors: ['400', '401', '403'],
    }),
  },
  '/api/v1/reports/my/{id}': {
    get: op({
      operationId: 'getMyReport',
      tags: ['Reports'],
      summary: 'Get own report',
      parameters: [idParam()],
      data: obj,
      errors: ['401', '403', '404'],
    }),
  },
};
