// js/blogs.js — Teachings & Blogs logic

document.addEventListener('DOMContentLoaded', () => {
    loadBlogs();
});

let allBlogs = [];

async function loadBlogs() {
    const listEl = document.getElementById('blogsList');
    const filtersEl = document.getElementById('blogFilters');
    
    if (!listEl) return;

    try {
        const response = await fetch('/api/blogs');
        const result = await response.json();

        if (response.ok && result.data) {
            allBlogs = result.data;
            renderBlogs(allBlogs);
            renderFilters(allBlogs, filtersEl);
        } else {
            showEmptyState('Could not load teachings.');
        }
    } catch (err) {
        showEmptyState('Failed to connect to the server.');
    }
}

function renderBlogs(blogs) {
    const listEl = document.getElementById('blogsList');
    if (blogs.length === 0) {
        showEmptyState('No teachings found matching your criteria.');
        return;
    }

    listEl.innerHTML = blogs.map((blog, i) => {
        const dateStr = new Date(blog.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
        
        // Extract a short snippet
        const div = document.createElement('div');
        div.innerHTML = blog.content || '';
        const textContent = div.textContent || div.innerText || '';
        const snippet = textContent.length > 150 ? textContent.substring(0, 150) + '...' : textContent;

        return `
        <div class="card event-card-full" data-aos="fade-up" data-aos-delay="${(i % 5) * 50}">
            <div class="event-date" style="background:var(--gradient-gold); color:var(--midnight);">
                <div class="event-date-day">📖</div>
            </div>
            <div class="event-details">
                <div class="event-badges">
                    <span class="card-badge" style="background:var(--midnight); color:var(--gold); border: 1px solid var(--gold);">${blog.category || 'Teaching'}</span>
                </div>
                <h3 class="card-title">${blog.title}</h3>
                <p class="card-text">${snippet}</p>
                <div class="event-meta">
                    <div class="event-meta-item">✍️ ${blog.author || 'KANI Ministry'}</div>
                    <div class="event-meta-item">📅 ${dateStr}</div>
                </div>
            </div>
            <div class="event-action">
                <button onclick="openBlogModal('${blog.id}')" class="btn btn-outline" style="border-color:var(--gold); color:var(--gold);">Read Full</button>
            </div>
        </div>`;
    }).join('');
}

function showEmptyState(message) {
    const listEl = document.getElementById('blogsList');
    listEl.innerHTML = `
        <div class="events-empty" data-aos="fade-in">
            <div class="events-empty-icon">📝</div>
            <h3>No Teachings Found</h3>
            <p>${message}</p>
        </div>`;
}

function renderFilters(blogs, filtersEl) {
    if (!filtersEl) return;
    const categories = ['All', ...new Set(blogs.map(b => b.category || 'Teaching'))];
    
    filtersEl.innerHTML = categories.map(cat => 
        `<button class="event-filter-pill ${cat === 'All' ? 'active' : ''}" onclick="filterBlogs('${cat}', this)">${cat}</button>`
    ).join('');
}

window.filterBlogs = function(category, btnEl) {
    // Update active state
    document.querySelectorAll('.event-filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    // Filter array
    if (category === 'All') {
        renderBlogs(allBlogs);
    } else {
        const filtered = allBlogs.filter(b => (b.category || 'Teaching') === category);
        renderBlogs(filtered);
    }
}

window.openBlogModal = function(id) {
    const blog = allBlogs.find(b => b.id === id);
    if (!blog) return;

    document.getElementById('modalBlogCategory').textContent = blog.category || 'Teaching';
    document.getElementById('modalBlogTitle').textContent = blog.title;
    const dateStr = new Date(blog.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('modalBlogAuthor').textContent = `By ${blog.author || 'KANI Ministry'} on ${dateStr}`;
    document.getElementById('modalBlogContent').innerHTML = blog.content || '';

    const modal = document.getElementById('blogModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

window.closeBlogModal = function() {
    const modal = document.getElementById('blogModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Close on backdrop click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('blogModal');
    if (e.target === modal) {
        closeBlogModal();
    }
});
