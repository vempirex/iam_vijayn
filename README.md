# ✍️ iam_vijayn — Minimalist Writing Wall

**iam_vijayn** is a premium, minimal Pinterest-style writing board where users can publish short written thoughts, notes, ideas, stories, poems, or opinions. Instead of images, the platform displays content cards beautifully arranged in an interactive, responsive masonry layout. 

Featuring an elegant glassmorphic dark design, full real-time database synchronisation, touch-friendly deletion, frontend search/filtering, and automatic state management.

---

## ✨ Features

- 🌌 **Premium Aesthetics**: Dark mode by default, custom radial gradients, obsidian backdrops, and glassmorphic card effects.
- 📐 **Responsive Masonry Grid**: Optimized multi-column CSS grid that adjusts based on device size (1 column on mobile, 2 on tablet, 4 on desktop). No unnecessary layout shifts.
- ⚡ **Real-Time Sync**: Driven by Supabase Postgres subscriptions; newly published posts and deleted items synchronize instantly for all concurrent visitors without page refresh.
- 👆 **Interactive Gestures**:
  - **Desktop**: Hover scaling and right-click trigger delete.
  - **Mobile**: Long-press holding visual shake/vibrate haptic feedback triggers delete.
- 🔍 **Dynamic Filters**: Instant frontend fuzzy search by text/content and filtering by writer names.
- 📝 **Composer Modal**: Dynamic character counters (Title: 80, Body: 2000, Writer: 40) with real-time field validation.
- 🚀 **Credential Setup Wizard**: Fallback configuration wizard built into the page. If credentials are not hardcoded, users can paste their keys temporarily to run the site instantly.
- 📈 **Performance & SEO**: Fluid typography (Cinzel & Plus Jakarta Sans), native SVG icons for zero latency, skeleton card loaders, and search engine meta headers.

---

## 📂 Project Structure

```
d:\iam_vijayn\
├── index.html          # Main HTML5 semantic page
├── style.css           # Custom CSS styling (glassmorphic theme, responsive layouts, animations)
├── app.js              # Application logic (Supabase integration, touch handlers, real-time channels)
├── config.js           # Configuration keys (production values and local storage fallbacks)
├── schema.sql          # PostgreSQL table definition & RLS security script
├── vercel.json         # Vercel security headers and clean URL routing config
└── README.md           # Documentation
```

---

## 🛠️ Step 1: Database Setup (Supabase)

1. Create a free account on [Supabase](https://supabase.com/).
2. Initialize a new project and select your database region.
3. Open the **SQL Editor** in the left navigation sidebar.
4. Click **New Query** and copy-paste the contents of [`schema.sql`](file:///d:/iam_vijayn/schema.sql):
   ```sql
   -- Create posts table, enable RLS policies, and add realtime publication
   CREATE TABLE IF NOT EXISTS public.posts (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       title VARCHAR(80) NOT NULL CHECK (char_length(trim(title)) > 0),
       body VARCHAR(2000) NOT NULL CHECK (char_length(trim(body)) > 0),
       writer_name VARCHAR(40) NOT NULL CHECK (char_length(trim(writer_name)) > 0),
       created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
   );
   ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Allow public read access" ON public.posts FOR SELECT USING (true);
   CREATE POLICY "Allow public insert access" ON public.posts FOR INSERT WITH CHECK (true);
   CREATE POLICY "Allow public delete access" ON public.posts FOR DELETE USING (true);
   
   -- Enable real-time replication
   ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
   ```
5. Click **Run** to execute the script and build your backend.

---

## 💻 Step 2: Local Setup & Running

Because the project utilizes native Javascript ES Modules (`import/export`) for modularity and speed, modern browsers restrict local execution direct from file paths (`file://...`) due to CORS security requirements.

To run the application locally, you **must use a lightweight local HTTP server**:

### Option A: Using `npx` (Easiest, no installation needed)
Open your terminal inside the project directory (`d:\iam_vijayn`) and run:
```bash
npx serve
```
This will start a local server at `http://localhost:3000` (or another port).

### Option B: Using Python (Built-in on many systems)
Run the following in your terminal:
```bash
# Python 3
python -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

### Option C: VS Code Live Server Extension
If you use VS Code, right-click `index.html` and click **"Open with Live Server"**.

---

## ⚙️ Step 3: Configure Credentials

When you first load the website, you will see a sleek **Configure Supabase** setup screen. You can:
1. Paste your Supabase **Project URL** and **API Anon Key**.
2. Click **Connect Database** to store them locally in your browser cache.
3. *Optional for production*: To permanently bundle these keys, open [`config.js`](file:///d:/iam_vijayn/config.js) and write them directly inside the `CONFIG` object:
   ```javascript
   const CONFIG = {
       SUPABASE_URL: "https://your-project.supabase.co", 
       SUPABASE_ANON_KEY: "eyJhbGciOi...",
       ...
   ```

---

## 🚀 Step 4: Hosting on Vercel

The application is fully optimized for immediate hosting on Vercel:

### Method A: Deploy via GitHub (Recommended)
1. Commit and push the project files to a private/public GitHub repository.
2. Go to your [Vercel Dashboard](https://vercel.com/) and click **Add New Project**.
3. Import your repository, select **Other / Plain HTML** as the project preset, and click **Deploy**.

### Method B: Deploy via Vercel CLI
If you have Vercel CLI installed:
```bash
# Run inside d:\iam_vijayn
vercel
```
Follow the interactive prompts to deploy. To push to production:
```bash
vercel --prod
```
The included [`vercel.json`](file:///d:/iam_vijayn/vercel.json) will automatically enforce high-security headers (CSP, X-Frame, X-Content-Type) and clean up browser routing!

---

## 🎮 How to Interact with the Writing Wall

- **Read Posts**: Click on any card in the masonry layout to expand it in a beautiful full-screen reading overlay.
- **Write Thoughts**: Click the **Pen (Compose)** icon in the top right to launch the editor modal. Live counters will guide your word count.
- **Search & Filtering**: Type query keywords into the search bar, or select a writer's name from the dynamic dropdown filter to isolate cards instantly.
- **Delete Posts**: 
  - **Desktop**: Right-click on any post card to open the permanent deletion warning prompt.
  - **Mobile / Touch**: Touch and hold (long-press) a card. The card will start **vibrating visually (shaking)** to indicate a hold event. After holding for 600ms, the delete modal will display automatically.
