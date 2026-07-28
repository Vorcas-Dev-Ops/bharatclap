import dynamic from 'next/dynamic';

const AdminSettlementsPage = dynamic(
  () => import('@/components/admin/settlements/AdminSettlementsPage'),
  {
    loading: () => (
      <div className="h-96 w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    ),
  }
);

export const metadata = {
  title: 'Settlements & Payouts | BharatClap Admin',
  description: 'Manage provider commission settlements, escrow holds, and bank payouts.',
};

export default function Page() {
  return <AdminSettlementsPage />;
}
