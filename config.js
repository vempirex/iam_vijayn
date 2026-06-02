// Configuration for "iam_vijayn" Writing Wall
// Credentials are automatically fetched from the Vercel backend API.

const CONFIG = {
    SUPABASE_URL: "", 
    SUPABASE_ANON_KEY: "",

    getSupabaseUrl() {
        return this.SUPABASE_URL;
    },

    getSupabaseAnonKey() {
        return this.SUPABASE_ANON_KEY;
    },

    // Check if both credentials are set
    hasCredentials() {
        return this.getSupabaseUrl().trim() !== "" && this.getSupabaseAnonKey().trim() !== "";
    },

    // Fetch configuration from the backend
    async init() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const data = await response.json();
                if (data.supabaseUrl && data.supabaseAnonKey) {
                    this.SUPABASE_URL = data.supabaseUrl.trim();
                    this.SUPABASE_ANON_KEY = data.supabaseAnonKey.trim();
                    return true;
                }
            }
        } catch (error) {
            console.error("Could not load backend configuration:", error);
        }
        return false;
    }
};

export default CONFIG;
