import CONFIG from './config.js';

// ==========================================
// STATE MANAGEMENT & GLOBAL VARIABLES
// ==========================================
let supabaseClient = null;
let allPosts = []; // In-memory cache for search & filtering
let allReactions = []; // In-memory cache for reactions
let allComments = []; // In-memory cache for comments
let activeDeleteId = null;
let currentViewPostId = null;
let touchTimeout = null;
let isHolding = false;
let isSupabaseConnected = false;

// DOM Selectors
const grid = document.getElementById('masonry-grid');
const emptyState = document.getElementById('empty-state');
const scrollTopBtn = document.getElementById('btn-scroll-top');
const searchInput = document.getElementById('search-input');
const writerFilter = document.getElementById('writer-filter');

// Modals
const modalCompose = document.getElementById('modal-compose');
const modalView = document.getElementById('modal-view');
const modalDelete = document.getElementById('modal-delete');

// Forms & Inputs
const formCompose = document.getElementById('form-compose');
const postTitle = document.getElementById('post-title');
const postBody = document.getElementById('post-body');
const postWriter = document.getElementById('post-writer');

const countTitle = document.getElementById('count-title');
const countBody = document.getElementById('count-body');
const countWriter = document.getElementById('count-writer');

// Comments & Share
const formComment = document.getElementById('form-comment');
const commentName = document.getElementById('comment-name');
const commentText = document.getElementById('comment-text');
const commentsList = document.getElementById('comments-list');
const commentsCount = document.getElementById('comments-count');
const viewReactions = document.getElementById('view-reactions');

const btnViewShare = document.getElementById('btn-view-share');
const shareMenu = document.getElementById('share-menu');

// ==========================================
// TOAST NOTIFICATIONS ENGINE
// ==========================================
const toastContainer = document.getElementById('toast-container');

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon based on type
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
        ${iconSvg}
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Slide out and remove
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 4000);
}

// ==========================================
// INITIALIZATION & CONNECTION
// ==========================================
async function initApp() {
    setupEventListeners();
    
    await CONFIG.init();
    
    if (CONFIG.hasCredentials()) {
        connectToSupabase(CONFIG.getSupabaseUrl(), CONFIG.getSupabaseAnonKey());
    } else {
        showToast("Database configuration is missing. Please set environment variables on your server.", "error");
    }
}

function connectToSupabase(url, key) {
    try {
        // Init Supabase client from CDN global
        if (!window.supabase) {
            throw new Error("Supabase library not loaded. Check internet connection.");
        }
        
        supabaseClient = window.supabase.createClient(url, key);
        isSupabaseConnected = true;
        
        showToast("Connected to database successfully!", "success");
        
        // Fetch posts & start real-time subscription
        loadPosts();
        setupRealtimeSubscription();
        
    } catch (error) {
        console.error("Connection Error:", error);
        showToast(`Connection failed: ${error.message}`, "error");
    }
}

// ==========================================
// DATABASE FETCH & REALTIME ENGINE
// ==========================================
async function loadPosts() {
    showLoadingSkeletons();
    
    try {
        const [postsRes, reactionsRes] = await Promise.all([
            supabaseClient.from('posts').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('reactions').select('*')
        ]);
            
        if (postsRes.error) throw postsRes.error;
        if (reactionsRes.error) console.error("Reactions Fetch Error:", reactionsRes.error);
        
        allPosts = postsRes.data || [];
        allReactions = reactionsRes.data || [];
        
        renderGrid();
        updateWriterFilterOptions();
        
        // Handle direct linking to a post
        const path = window.location.pathname;
        if (path.startsWith('/post/')) {
            const postId = path.split('/')[2];
            const targetPost = allPosts.find(p => p.id === postId);
            if (targetPost) {
                openDetailView(targetPost);
            }
        }
        
    } catch (error) {
        console.error("Fetch Error:", error);
        
        let customMessage = "Failed to fetch thoughts from Supabase.";
        
        // Specific Postgres and connection errors
        if (error.code === '42P01') {
            customMessage = "Table 'posts' does not exist in Supabase. Please run the SQL schema script.";
        } else if (error.status === 401 || error.status === 403 || (error.message && (error.message.includes('JWT') || error.message.includes('key')))) {
            customMessage = "Invalid Supabase credentials. Please check your environment variables.";
        } else if (error.message) {
            customMessage = `Fetch failed: ${error.message}`;
        }
        
        showToast(customMessage, "error");
        hideLoadingSkeletons();
        updateEmptyState();
    }
}

function setupRealtimeSubscription() {
    try {
        supabaseClient
            .channel('public:all')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
                handlePostRealtimeEvent(payload);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (payload) => {
                handleReactionRealtimeEvent(payload);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
                handleCommentRealtimeEvent(payload);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log("Subscribed to real-time feeds.");
                }
            });
    } catch (error) {
        console.error("Realtime Subscription Error:", error);
    }
}

function handleReactionRealtimeEvent(payload) {
    const newReaction = payload.new;
    if (!allReactions.some(r => r.id === newReaction.id)) {
        allReactions.push(newReaction);
        renderGrid();
        if (currentViewPostId === newReaction.post_id) {
            renderDetailReactions();
        }
    }
}

function handleCommentRealtimeEvent(payload) {
    const newComment = payload.new;
    if (!allComments.some(c => c.id === newComment.id)) {
        allComments.push(newComment);
        if (currentViewPostId === newComment.post_id) {
            renderCommentsList();
        }
    }
}

function handlePostRealtimeEvent(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'INSERT') {
        // Add to global state if not already there
        if (!allPosts.some(p => p.id === newRecord.id)) {
            allPosts.unshift(newRecord);
            renderGrid();
            updateWriterFilterOptions();
            showToast(`A new spark was written by ${newRecord.writer_name}!`, "success");
        }
    } 
    else if (eventType === 'DELETE') {
        const removedIndex = allPosts.findIndex(p => p.id === oldRecord.id);
        if (removedIndex !== -1) {
            const writerName = allPosts[removedIndex].writer_name;
            allPosts.splice(removedIndex, 1);
            
            // Handle visual removal from grid instantly
            const cardEl = document.querySelector(`[data-id="${oldRecord.id}"]`);
            if (cardEl) {
                cardEl.classList.remove('animate-in');
                cardEl.style.transform = 'scale(0.8) translateY(20px)';
                cardEl.style.opacity = '0';
                cardEl.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                
                setTimeout(() => {
                    renderGrid();
                    updateWriterFilterOptions();
                }, 300);
            } else {
                renderGrid();
                updateWriterFilterOptions();
            }
            showToast("A thought was removed from the wall.", "info");
        }
    }
}

// ==========================================
// RENDER MASONRY GRID & SEARCH / FILTER
// ==========================================
function renderGrid() {
    hideLoadingSkeletons();
    
    const searchText = searchInput.value.toLowerCase().trim();
    const filterWriter = writerFilter.value;
    
    // Filter cache
    const filteredPosts = allPosts.filter(post => {
        const matchesSearch = post.title.toLowerCase().includes(searchText) || 
                              post.body.toLowerCase().includes(searchText);
        const matchesWriter = filterWriter === "" || post.writer_name === filterWriter;
        return matchesSearch && matchesWriter;
    });
    
    if (filteredPosts.length === 0) {
        grid.innerHTML = '';
        updateEmptyState(true);
        return;
    }
    
    updateEmptyState(false);
    
    // Construct Grid Items safely
    grid.innerHTML = filteredPosts.map((post, index) => {
        const dateStr = formatFuzzyDate(post.created_at);
        const isTruncated = post.body.length > 350;
        const bodyPreview = isTruncated ? post.body.substring(0, 350) : post.body;
        
        return `
            <div class="masonry-item animate-in" data-id="${post.id}" style="animation-delay: ${index * 0.05}s">
                <article class="post-card" tabindex="0">
                    <h3 class="card-title">${escapeHTML(post.title)}</h3>
                    <p class="card-body ${isTruncated ? 'truncated' : ''}">${escapeHTML(bodyPreview)}</p>
                    <div class="card-footer">
                        <span class="card-writer">@${escapeHTML(post.writer_name)}</span>
                        <span class="card-date">${dateStr}</span>
                    </div>
                    <div class="card-action-bar" onclick="event.stopPropagation()">
                        <div class="card-action-btns">
                            ${getReactionsHtml(post.id)}
                        </div>
                        <div class="card-action-btns" style="gap: 0.8rem;">
                            <span title="Comments" style="cursor: pointer; color: var(--text-secondary);" onclick="openDetailViewFromId('${post.id}')">💬</span>
                            <span title="Share" style="cursor: pointer; color: var(--text-secondary);" onclick="handleShare('${post.id}')">🔗</span>
                        </div>
                    </div>
                </article>
            </div>
        `;
    }).join('');
    
    setupCardInteractions();
}

function updateWriterFilterOptions() {
    const currentSelection = writerFilter.value;
    
    // Get unique writer names
    const writers = [...new Set(allPosts.map(p => p.writer_name))].sort((a, b) => a.localeCompare(b));
    
    // Re-create options
    writerFilter.innerHTML = '<option value="">All Writers</option>' + 
        writers.map(writer => `<option value="${escapeHTML(writer)}">${escapeHTML(writer)}</option>`).join('');
        
    // Restore selection if it still exists
    if (writers.includes(currentSelection)) {
        writerFilter.value = currentSelection;
    } else {
        writerFilter.value = "";
    }
}

function updateEmptyState(isEmpty = (allPosts.length === 0)) {
    if (isEmpty) {
        emptyState.classList.remove('hidden');
        grid.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        grid.classList.remove('hidden');
    }
}

function showLoadingSkeletons() {
    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    let skeletonHtml = '';
    for (let i = 0; i < 8; i++) {
        skeletonHtml += `
            <div class="masonry-item">
                <div class="post-card skeleton-card">
                    <div>
                        <div class="skeleton-line skeleton-title"></div>
                        <div class="skeleton-line skeleton-body-1"></div>
                        <div class="skeleton-line skeleton-body-2"></div>
                        <div class="skeleton-line skeleton-body-3"></div>
                        <div class="skeleton-line skeleton-body-4"></div>
                    </div>
                    <div class="card-footer" style="border: none;">
                        <div class="skeleton-line skeleton-footer-left"></div>
                        <div class="skeleton-line skeleton-footer-right"></div>
                    </div>
                </div>
            </div>
        `;
    }
    grid.innerHTML = skeletonHtml;
}

function hideLoadingSkeletons() {
    // Skeletons are cleared dynamically when rendering posts
}

// ==========================================
// CARD INTERACTION ENGINE (CLICK, RIGHT CLICK, LONG PRESS)
// ==========================================
function setupCardInteractions() {
    const cards = document.querySelectorAll('.post-card');
    
    cards.forEach(card => {
        const item = card.closest('.masonry-item');
        const id = item.dataset.id;
        const post = allPosts.find(p => p.id === id);
        
        if (!post) return;
        
        // 1. Click to open details
        card.addEventListener('click', (e) => {
            // Prevent opening detail if we were long-pressing
            if (isHolding) return;
            openDetailView(post);
        });
        
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDetailView(post);
            }
        });
        
        // 2. Right-click contextmenu to delete
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            triggerDeletePrompt(post.id);
        });
        
        // 3. Touch holding logic for mobile long-press
        card.addEventListener('touchstart', (e) => {
            isHolding = false;
            card.classList.add('holding');
            
            touchTimeout = setTimeout(() => {
                isHolding = true;
                card.classList.remove('holding');
                triggerDeletePrompt(post.id);
            }, 600); // 600ms long press threshold
        }, { passive: true });
        
        const cancelHold = () => {
            clearTimeout(touchTimeout);
            card.classList.remove('holding');
            // Reset hold status after a short delay to block immediate clicks
            setTimeout(() => { isHolding = false; }, 50);
        };
        
        card.addEventListener('touchend', cancelHold);
        card.addEventListener('touchmove', cancelHold);
        card.addEventListener('touchcancel', cancelHold);
    });
}

// ==========================================
// DETAIL VIEW MODAL
// ==========================================
async function openDetailView(post) {
    currentViewPostId = post.id;
    const viewTitle = document.getElementById('view-modal-title');
    const viewBody = document.getElementById('view-modal-body');
    const viewWriter = document.getElementById('view-modal-writer');
    const viewDate = document.getElementById('view-modal-date');
    
    viewTitle.textContent = post.title;
    viewBody.textContent = post.body;
    viewWriter.textContent = `@${post.writer_name}`;
    viewDate.textContent = formatDetailedDate(post.created_at);
    
    // Reactions
    renderDetailReactions();
    
    // Comments
    commentsList.innerHTML = '<div class="skeleton-line" style="height: 20px; width: 100%;"></div>';
    commentsCount.textContent = '...';
    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .select('*')
            .eq('post_id', post.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        allComments = data || [];
        renderCommentsList();
    } catch(err) {
        commentsList.innerHTML = '<div class="comment-empty">Error loading comments</div>';
    }
    
    formComment.reset();
    shareMenu.classList.add('hidden');
    openModal(modalView);
}

window.openDetailViewFromId = function(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (post) openDetailView(post);
}

// ==========================================
// DELETE HANDLERS
// ==========================================
function triggerDeletePrompt(id) {
    activeDeleteId = id;
    openModal(modalDelete);
}

async function executeDelete() {
    if (!activeDeleteId || !isSupabaseConnected) return;
    
    const confirmBtn = document.getElementById('btn-confirm-delete');
    const spinner = confirmBtn.querySelector('.spinner');
    const btnText = confirmBtn.querySelector('.btn-text');
    
    confirmBtn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0.5';
    
    try {
        const { error } = await supabaseClient
            .from('posts')
            .delete()
            .eq('id', activeDeleteId);
            
        if (error) throw error;
        
        closeModal(modalDelete);
        
    } catch (error) {
        console.error("Delete Error:", error);
        showToast("Error: Could not delete thought from database.", "error");
    } finally {
        confirmBtn.disabled = false;
        spinner.classList.add('hidden');
        btnText.style.opacity = '1';
        activeDeleteId = null;
    }
}

// ==========================================
// COMPOSE & PUBLISH HANDLERS
// ==========================================
async function handlePublishSubmit(e) {
    e.preventDefault();
    if (!isSupabaseConnected) return;
    
    const titleVal = postTitle.value.trim();
    const bodyVal = postBody.value.trim();
    const writerVal = postWriter.value.trim();
    
    let isValid = true;
    
    // Clear previous invalid states
    document.querySelectorAll('.form-group').forEach(grp => grp.classList.remove('invalid'));
    
    if (titleVal === "") {
        postTitle.closest('.form-group').classList.add('invalid');
        isValid = false;
    }
    if (bodyVal === "") {
        postBody.closest('.form-group').classList.add('invalid');
        isValid = false;
    }
    if (writerVal === "") {
        postWriter.closest('.form-group').classList.add('invalid');
        isValid = false;
    }
    
    if (!isValid) return;
    
    const submitBtn = document.getElementById('btn-publish-submit');
    const spinner = submitBtn.querySelector('.spinner');
    const btnText = submitBtn.querySelector('.btn-text');
    
    submitBtn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.style.opacity = '0.5';
    
    try {
        const { data, error } = await supabaseClient
            .from('posts')
            .insert([
                { 
                    title: titleVal, 
                    body: bodyVal, 
                    writer_name: writerVal 
                }
            ]);
            
        if (error) throw error;
        
        // Reset and close
        formCompose.reset();
        updateCharacterCounters();
        closeModal(modalCompose);
        
    } catch (error) {
        console.error("Publish Error:", error);
        showToast("Error publishing post: Make sure SQL tables are ready.", "error");
    } finally {
        submitBtn.disabled = false;
        spinner.classList.add('hidden');
        btnText.style.opacity = '1';
    }
}

function updateCharacterCounters() {
    countTitle.textContent = `${postTitle.value.length} / 80`;
    countBody.textContent = `${postBody.value.length} / 2000`;
    countWriter.textContent = `${postWriter.value.length} / 40`;
}

// ==========================================
// MODAL GENERAL CONTROLS
// ==========================================
function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock scroll background
}

function closeModal(modal) {
    if (modal.dataset.preventClose === "true") return;
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Unlock scroll
}

// ==========================================
// EVENT LISTENERS SYSTEM
// ==========================================
function setupEventListeners() {
    // 1. Compose Modals Open/Close
    document.getElementById('btn-open-compose').addEventListener('click', () => openModal(modalCompose));
    document.getElementById('btn-empty-compose').addEventListener('click', () => openModal(modalCompose));
    
    document.getElementById('btn-close-compose').addEventListener('click', () => closeModal(modalCompose));
    document.getElementById('btn-cancel-compose').addEventListener('click', () => closeModal(modalCompose));
    
    // 2. View Modals Close
    document.getElementById('btn-close-view').addEventListener('click', () => {
        currentViewPostId = null;
        if(shareMenu) shareMenu.classList.add('hidden');
        closeModal(modalView);
    });
    
    // 3. Delete Modals Cancel/Confirm
    document.getElementById('btn-cancel-delete').addEventListener('click', () => closeModal(modalDelete));
    document.getElementById('btn-confirm-delete').addEventListener('click', executeDelete);
    
    // 4. Close on overlay backdrop clicks
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (overlay === modalView) {
                    currentViewPostId = null;
                    if(shareMenu) shareMenu.classList.add('hidden');
                }
                closeModal(overlay);
            }
        });
    });
    
    // ESC key closes modals
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openOverlays = document.querySelectorAll('.modal-overlay:not(.hidden)');
            openOverlays.forEach(overlay => {
                if (overlay === modalView) {
                    currentViewPostId = null;
                    if(shareMenu) shareMenu.classList.add('hidden');
                }
                closeModal(overlay);
            });
        }
    });
    
    // 5. Compose Form submit
    formCompose.addEventListener('submit', handlePublishSubmit);
    
    // Comments Form Submit
    if (formComment) {
        formComment.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!isSupabaseConnected || !currentViewPostId) return;
            
            const nameVal = commentName.value.trim();
            const textVal = commentText.value.trim();
            if (!nameVal || !textVal) return;
            
            const btnSubmit = formComment.querySelector('.btn-submit-comment');
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = '0.5';
            
            try {
                const { error } = await supabaseClient
                    .from('comments')
                    .insert([{ post_id: currentViewPostId, commenter_name: nameVal, comment_text: textVal }]);
                if (error) throw error;
                
                formComment.reset();
                showToast("Comment posted!", "success");
            } catch(err) {
                console.error("Comment Error:", err);
                showToast("Failed to post comment", "error");
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.style.opacity = '1';
            }
        });
    }

    // Share Dropdown Logic
    if (btnViewShare) {
        btnViewShare.addEventListener('click', (e) => {
            e.stopPropagation();
            shareMenu.classList.toggle('hidden');
        });

        document.querySelectorAll('.share-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!currentViewPostId) return;
                const platform = btn.dataset.platform;
                const url = `${window.location.origin}/post/${currentViewPostId}`;
                const post = allPosts.find(p => p.id === currentViewPostId);
                const title = encodeURIComponent(post ? post.title : 'iam_vijayn');
                const encodedUrl = encodeURIComponent(url);
                
                shareMenu.classList.add('hidden');
                
                switch (platform) {
                    case 'copy':
                        copyToClipboard(url);
                        break;
                    case 'whatsapp':
                        window.open(`https://api.whatsapp.com/send?text=${title}%20${encodedUrl}`, '_blank');
                        break;
                    case 'twitter':
                        window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${title}`, '_blank');
                        break;
                    case 'telegram':
                        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${title}`, '_blank');
                        break;
                }
            });
        });

        document.addEventListener('click', () => {
            if(!shareMenu.classList.contains('hidden')) {
                shareMenu.classList.add('hidden');
            }
        });
    }
    
    // 6. Character limits validation & live counters
    [postTitle, postBody, postWriter].forEach(el => {
        el.addEventListener('input', () => {
            updateCharacterCounters();
            el.closest('.form-group').classList.remove('invalid');
        });
    });
    
    // 7. Search & Filtering input listeners
    searchInput.addEventListener('input', renderGrid);
    writerFilter.addEventListener('change', renderGrid);
    
    // Logo links trigger filter clearing
    document.getElementById('logo-link').addEventListener('click', (e) => {
        e.preventDefault();
        searchInput.value = "";
        writerFilter.value = "";
        renderGrid();
    });
    
    // 10. Sticky Header and Scroll-To-Top button visibility
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.app-header');
        if (window.scrollY > 30) {
            header.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';
        } else {
            header.style.boxShadow = 'none';
        }
        
        if (window.scrollY > 300) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    }, { passive: true });
    
    // Scroll to Top behavior
    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ==========================================
// UTILITIES & HELPER FUNCTIONS
// ==========================================
function formatFuzzyDate(timestamp) {
    if (!timestamp) return 'just now';
    
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    
    // Return abbreviated month name and day e.g., 'Oct 23'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDetailedDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Initialize when DOM is complete
document.addEventListener('DOMContentLoaded', initApp);

// ==========================================
// REACTIONS, COMMENTS & SHARE ENGINE
// ==========================================

const REACTION_TYPES = [
    { type: 'loved', icon: '❤️' },
    { type: 'powerful', icon: '🔥' },
    { type: 'thoughtful', icon: '🤔' },
    { type: 'emotional', icon: '😢' }
];

window.toggleReaction = async function(e, postId, reactionType) {
    e.stopPropagation();
    if (!isSupabaseConnected) return;
    
    const localKey = `reacted_${postId}_${reactionType}`;
    if (localStorage.getItem(localKey)) {
        showToast("You have already reacted this way.", "info");
        return;
    }
    
    // Optimistic UI update
    localStorage.setItem(localKey, 'true');
    const newReaction = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
        post_id: postId,
        reaction_type: reactionType,
        created_at: new Date().toISOString()
    };
    allReactions.push(newReaction);
    renderGrid();
    if (currentViewPostId === postId) {
        renderDetailReactions();
    }
    
    try {
        const { error } = await supabaseClient
            .from('reactions')
            .insert([{ post_id: postId, reaction_type: reactionType }]);
            
        if (error) throw error;
    } catch (err) {
        console.error("Reaction Error:", err);
        localStorage.removeItem(localKey);
        allReactions = allReactions.filter(r => r.id !== newReaction.id);
        renderGrid();
        if (currentViewPostId === postId) {
            renderDetailReactions();
        }
        showToast("Could not send reaction.", "error");
    }
}

window.getReactionsHtml = function(postId) {
    const postReactions = allReactions.filter(r => r.post_id === postId);
    return REACTION_TYPES.map(t => {
        const count = postReactions.filter(r => r.reaction_type === t.type).length;
        const hasReacted = localStorage.getItem(`reacted_${postId}_${t.type}`);
        return `
            <button class="reaction-btn ${hasReacted ? 'active' : ''}" onclick="toggleReaction(event, '${postId}', '${t.type}')" aria-label="${t.type}">
                <span class="reaction-icon">${t.icon}</span>
                <span class="reaction-count">${count > 0 ? count : ''}</span>
            </button>
        `;
    }).join('');
}

window.renderDetailReactions = function() {
    if (!currentViewPostId || !viewReactions) return;
    viewReactions.innerHTML = getReactionsHtml(currentViewPostId);
}

window.renderCommentsList = function() {
    if (!currentViewPostId || !commentsList || !commentsCount) return;
    const postComments = allComments.filter(c => c.post_id === currentViewPostId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // newest first
        
    commentsCount.textContent = postComments.length;
    
    if (postComments.length === 0) {
        commentsList.innerHTML = '<div class="comment-empty">Be the first to comment.</div>';
        return;
    }
    
    commentsList.innerHTML = postComments.map(c => `
        <div class="comment-item">
            <div class="comment-header">
                <span class="comment-name">${escapeHTML(c.commenter_name)}</span>
                <span class="comment-date">${formatFuzzyDate(c.created_at)}</span>
            </div>
            <div class="comment-body">${escapeHTML(c.comment_text)}</div>
        </div>
    `).join('');
}

window.handleShare = function(postId) {
    const shareUrl = `${window.location.origin}/post/${postId}`;
    const post = allPosts.find(p => p.id === postId);
    
    if (navigator.share) {
        navigator.share({
            title: post ? post.title : 'iam_vijayn',
            text: post ? `Read this thought by ${post.writer_name}` : 'Check out this thought',
            url: shareUrl,
        }).catch(err => {
            console.log("Share failed", err);
        });
    } else {
        copyToClipboard(shareUrl);
    }
}

window.copyToClipboard = function(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Link copied to clipboard!", "success");
        }).catch(err => {
            console.error("Copy failed", err);
            showToast("Could not copy link", "error");
        });
    } else {
        showToast("Clipboard copy not supported", "error");
    }
}
