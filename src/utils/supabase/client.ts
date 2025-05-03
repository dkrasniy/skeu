import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
   "https://fcsigeadqscxaokqhpuz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjc2lnZWFkcXNjeGFva3FocHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzMTQ1MzEsImV4cCI6MjA2MTg5MDUzMX0.Bdr3Hm5NxvhqamHoTSr5PDFnl5e0GurLKbHkqxlCqe8"
  )
}