-- Database Schema for "iam_vijayn" Writing Wall
-- Execute this SQL script in the Supabase SQL Editor to set up your database.

-- 1. Create the posts table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(80) NOT NULL CHECK (char_length(trim(title)) > 0),
    body VARCHAR(2000) NOT NULL CHECK (char_length(trim(body)) > 0),
    writer_name VARCHAR(40) NOT NULL CHECK (char_length(trim(writer_name)) > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- policy to allow anyone to read posts
CREATE POLICY "Allow public read access" ON public.posts
    FOR SELECT USING (true);

-- policy to allow anyone to insert a new post
CREATE POLICY "Allow public insert access" ON public.posts
    FOR INSERT WITH CHECK (true);

-- policy to allow anyone to delete a post (for minimal public writing wall)
CREATE POLICY "Allow public delete access" ON public.posts
    FOR DELETE USING (true);

-- 4. Enable real-time updates for the posts table
-- Note: supabase_realtime is a pre-defined publication in modern Supabase projects.
DO $$
BEGIN
  -- Safely add 'posts' to the realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
EXCEPTION
  WHEN undefined_object THEN
    -- In case supabase_realtime publication does not exist yet, create it
    CREATE PUBLICATION supabase_realtime FOR TABLE public.posts;
END $$;
