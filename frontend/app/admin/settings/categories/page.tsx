import React from 'react';
import CategoryRulesPage from '@/components/admin/settings/CategoryRulesPage';

export const metadata = {
  title: 'Category Dispatch Rules | Admin',
  description: 'Manage per-service category daily job caps and emergency rules',
};

export default function CategoryRulesAdminPage() {
  return <CategoryRulesPage />;
}
