import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://yotwxuadscekcscjqnpd.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdHd4dWFkc2Nla2NzY2pxbnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDMxNjQsImV4cCI6MjA5MjI3OTE2NH0.UAOMRleBUuv2-6Y9XwrAVLzXFTqcfgTPAdwdfqJhGww"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)