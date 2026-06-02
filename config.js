// Configuration for "iam_vijayn" Writing Wall
// Fill in your credentials below, or leave them empty to use the runtime configuration wizard.

const CONFIG = {
    // 1. HARDCODED CONFIGURATION (Recommended for production deployment)
    // Replace these empty strings with your actual Supabase URL and Anon Key.
    SUPABASE_URL: "", 
    SUPABASE_ANON_KEY: "",

    // 2. RUNTIME / LOCAL STORAGE CONFIGURATION (Fallback)
    // Allows testing the application instantly before deploying or hardcoding.
    getSupabaseUrl() {
        return (this.SUPABASE_URL && this.SUPABASE_URL.trim() !== "") 
            ? this.SUPABASE_URL 
            : localStorage.getItem('IAM_VIJAYN_SUPABASE_URL') || "";
    },

    getSupabaseAnonKey() {
        return (this.SUPABASE_ANON_KEY && this.SUPABASE_ANON_KEY.trim() !== "") 
            ? this.SUPABASE_ANON_KEY 
            : localStorage.getItem('IAM_VIJAYN_SUPABASE_ANON_KEY') || "";
    },

    // Check if both credentials are set
    hasCredentials() {
        return this.getSupabaseUrl().trim() !== "" && this.getSupabaseAnonKey().trim() !== "";
    },

    // Save credentials to local storage for quick testing
    saveCredentials(url, key) {
        if (url && key) {
            localStorage.setItem('IAM_VIJAYN_SUPABASE_URL', url.trim());
            localStorage.setItem('IAM_VIJAYN_SUPABASE_ANON_KEY', key.trim());
            return true;
        }
        return false;
    },

    // Clear saved credentials
    clearCredentials() {
        localStorage.removeItem('IAM_VIJAYN_SUPABASE_URL');
        localStorage.removeItem('IAM_VIJAYN_SUPABASE_ANON_KEY');
    }
};

export default CONFIG;
