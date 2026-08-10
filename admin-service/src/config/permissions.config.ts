import { AdminPermission } from '../types/permissions';

export const RolePermissionsMap: Record<string, AdminPermission[]> = {
  super_admin: Object.values(AdminPermission),
  operations_admin: [
    AdminPermission.CUSTOMER_VIEW,
    AdminPermission.PROVIDER_VIEW,
    AdminPermission.PROVIDER_KYC_APPROVE,
    AdminPermission.NOC_VIEW,
    AdminPermission.CHAT_VIEW,
    AdminPermission.CHAT_INTERVENE,
    AdminPermission.AUDIT_VIEW,
  ],
  finance_admin: [
    AdminPermission.FINANCE_VIEW,
    AdminPermission.FINANCE_SETTLEMENT,
    AdminPermission.FINANCE_REFUND,
    AdminPermission.REPORT_EXPORT,
    AdminPermission.AUDIT_VIEW,
  ],
};
