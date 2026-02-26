// Root page — redirects to dashboard or login

import { redirect } from 'next/navigation'

export default function RootPage() {
  // Redirect to the dashboard — the (dashboard) layout handles auth
  redirect('/app')
}
