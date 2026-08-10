import dynamic from 'next/dynamic';

const AdminFinanceDashboard = dynamic(
  () => import('@/components/admin/finance/AdminFinanceDashboard'),
  {
    loading: () => (
      <div className="h-96 w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    ),
  }
);

export const metadata = {
  title: 'Finance Dashboard | BharatClap Admin',
  description: 'Platform revenue, settlement pipeline, COD management, and financial health overview.',
};

export default function Page() {
  return <AdminFinanceDashboard />;
}
