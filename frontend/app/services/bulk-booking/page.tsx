import { redirect } from 'next/navigation';

export default function BulkBookingPage() {
  // Redirect to the main services page with the bulk-ordering category filter applied
  redirect('/services?category=bulk-ordering');
}
