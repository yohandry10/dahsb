'use client'

import { Suspense } from 'react'
import AlertsPageContent from './alerts-page-content'

function LoadingFallback() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">Loading alerts...</div>
    </main>
  )
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AlertsPageContent />
    </Suspense>
  )
}
