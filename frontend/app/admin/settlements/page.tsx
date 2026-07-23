import AdminSettlementsPage from "@/components/admin/settlements/AdminSettlementsPage";

export const metadata = {
  title: 'Settlements & Payouts | BharatClap Admin',
  description: 'Manage provider commission settlements, escrow holds, and bank payouts.',
};

export default function Page() {
  return <AdminSettlementsPage />;
}
