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

-- 4. Create the reactions table
CREATE TABLE IF NOT EXISTS public.reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    reaction_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to reactions" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to reactions" ON public.reactions FOR INSERT WITH CHECK (true);

-- 5. Create the comments table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    commenter_name VARCHAR(40) NOT NULL CHECK (char_length(trim(commenter_name)) > 0),
    comment_text VARCHAR(1000) NOT NULL CHECK (char_length(trim(comment_text)) > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to comments" ON public.comments FOR INSERT WITH CHECK (true);

-- 6. Enable real-time updates
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.posts, public.reactions, public.comments;
EXCEPTION
  WHEN undefined_object THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE public.posts, public.reactions, public.comments;
  WHEN others THEN
    NULL; -- Silently ignore if tables are already in publication
END $$;
