import { redirect } from 'next/navigation';

export default function LoansPage() {
  // Redirect to the main services page with the loans category filter applied
  redirect('/services?category=loans');
}
