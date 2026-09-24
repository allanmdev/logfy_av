export const SCOPES = {
  ACCOUNTS_READ: 'accounts:read',
  ACCOUNTS_WRITE: 'accounts:write',

  SHIPMENTS_READ: 'shipments:read',
  SHIPMENTS_WRITE: 'shipments:write',

  TRACKING_READ: 'tracking:read',

  ROUTING_READ: 'routing:read',
  ROUTING_WRITE: 'routing:write',

  WEBHOOKS_READ: 'webhooks:read',
  WEBHOOKS_WRITE: 'webhooks:write',
} as const;

export type Scope =
  (typeof SCOPES)[keyof typeof SCOPES];

export const AVAILABLE_SCOPES: Scope[] =
  Object.values(SCOPES);