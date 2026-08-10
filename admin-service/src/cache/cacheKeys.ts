export const CacheKeys = {
  customer360: (id: string) => `admin:cache:customer360:${id}`,
  provider360: (id: string) => `admin:cache:provider360:${id}`,
  nocTelemetry: () => `admin:cache:noc:telemetry`,
  dashboardMetrics: () => `admin:cache:dashboard:metrics`,
  financeMetrics: () => `admin:cache:finance:metrics`,
  chatDashboard: () => `admin:cache:chat:dashboard`,
  reports: (type: string) => `admin:cache:reports:${type}`,
};
