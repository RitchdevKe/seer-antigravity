-- Run this to fix the RLS permission error you just got:
ALTER TABLE public.ml_matrix_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_matrix_processed_matches DISABLE ROW LEVEL SECURITY;
