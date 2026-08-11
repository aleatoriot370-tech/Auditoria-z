import { NextResponse } from 'next/server'
import { isSupabaseEnabled } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 * Diagnostic endpoint to verify environment variables and Supabase connectivity.
 * Useful for debugging Netlify deployment issues.
 */
export async function GET() {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  // Don't expose the actual values, just whether they're set
  const urlPreview = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 30)}...`
    : '(not set)'

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    runtime: 'nodejs',
    supabase: {
      enabled: isSupabaseEnabled(),
      has_url: hasUrl,
      has_anon_key: hasAnonKey,
      has_service_role_key: hasServiceKey,
      url_preview: urlPreview,
    },
    environment: process.env.NODE_ENV || 'development',
  })
}
