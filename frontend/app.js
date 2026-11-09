const API = "";

function getImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API}${url}`;
}

let allPosts = [];
let settings = {};

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([loadStats(), loadPosts(), loadSettings()]);
  updateSchedulerStatus();
});

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll(".page-section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  document.querySelectorAll(".bottom-nav-item").forEach((n) => n.classList.remove("active"));

  document.getElementById(`section-${name}`)?.classList.add("active");
  document.getElementById(`nav-${name}`)?.classList.add("active");
  document.getElementById(`bnav-${name}`)?.classList.add("active");

  const titles = {
    approval: ["🕌 Approval Queue", "Review AI-generated Islamic posts before publishing"],
    history:  ["📅 Post History", "All generated posts and their status"],
    settings: ["⚙️ Settings", "Configure your Facebook and AI settings"],
    setup:    ["🚀 Setup Guide", "Connect your Facebook page and AI engine"],
  };
  if (titles[name]) {
    document.getElementById("topbarTitle").textContent = titles[name][0];
    document.getElementById("topbarSubtitle").textContent = titles[name][1];
  }

  if (name === "history") renderHistoryTable();
  closeMobileSidebar();
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar) sidebar.classList.toggle("mobile-open");
  if (backdrop) backdrop.classList.toggle("show");
}

function closeMobileSidebar() {
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar) sidebar.classList.remove("mobile-open");
  if (backdrop) backdrop.classList.remove("show");
}

// ── DATA LOADING ──────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch(`${API}/api/stats`);
    const data = await res.json();
    if (data.success) {
      const s = data.stats;
      document.getElementById("stat-total").textContent = s.total || 0;
      document.getElementById("stat-pending").textContent = s.pending || 0;
      document.getElementById("stat-published").textContent = s.published || 0;
      document.getElementById("stat-rejected").textContent = s.rejected || 0;

      const pending = s.pending || 0;
      document.getElementById("pendingBadge").textContent = pending;
      const bnavBadge = document.getElementById("bnavPendingBadge");
      if (bnavBadge) bnavBadge.textContent = pending;
      document.getElementById("pendingCount").textContent = `${pending} post${pending !== 1 ? "s" : ""} awaiting review`;
    }
  } catch (e) {
    console.error("Stats load error:", e);
  }
}

async function loadPosts() {
  try {
    const res = await fetch(`${API}/api/posts`);
    const data = await res.json();
    if (data.success) {
      allPosts = data.posts;
      renderApprovalQueue();
    }
  } catch (e) {
    console.error("Posts load error:", e);
    document.getElementById("pendingPostsGrid").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Cannot connect to server</div>
        <div class="empty-desc">Make sure the backend is running: <code>npm start</code></div>
      </div>`;
  }
}

async function loadSettings() {
  try {
    const res = await fetch(`${API}/api/settings`);
    const data = await res.json();
    if (data.success) {
      settings = data.settings;
      applySettingsToForm(settings);
      updateFbStatus(settings);
    }
  } catch (e) {
    console.error("Settings load error:", e);
  }
}

async function refreshData() {
  await Promise.all([loadStats(), loadPosts()]);
  showToast("🔄 Data refreshed!", "info");
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderApprovalQueue() {
  const pending = allPosts.filter((p) => p.status === "pending");
  const grid = document.getElementById("pendingPostsGrid");

  if (pending.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🕌</div>
        <div class="empty-title">No posts pending approval</div>
        <div class="empty-desc">
          Click <strong>"Generate Now"</strong> to create a new Quranic post,
          or wait for the daily scheduler to generate one automatically.
        </div>
        <button class="btn btn-primary" onclick="generatePost()">✨ Generate First Post</button>
      </div>`;
    return;
  }

  grid.innerHTML = pending.map((post) => createPostCard(post, true)).join("");
}

function createPostCard(post, showActions) {
  const statusClass = `badge-${post.status}`;
  const statusLabel = post.status.charAt(0).toUpperCase() + post.status.slice(1);
  const date = new Date(post.created_at).toLocaleDateString("en-PK", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const imageHtml = post.image_url
    ? `<img src="${getImageUrl(post.image_url)}" alt="Islamic post image" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'post-image-placeholder\\'>🕌</div>'" />`
    : `<div class="post-image-placeholder">🕌</div>`;

  const actions = showActions && (post.status === "pending" || post.status === "approved") ? `
    <div class="post-actions">
      <button class="btn btn-primary btn-sm" onclick="publishPost(${post.id})">📤 Publish to FB</button>
      ${post.status === "pending" ? `<button class="btn btn-success btn-sm" onclick="approvePost(${post.id})">✅ Approve</button>` : ""}
      <button class="btn btn-danger btn-sm" onclick="rejectPost(${post.id})">❌ Reject</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditModal(${post.id})">✏️ Edit</button>
      <button class="btn btn-ghost btn-sm" onclick="previewPost(${post.id})">👁️ Preview</button>
      <button class="btn btn-ghost btn-sm" onclick="regenerateImage(${post.id})">🖼️ Regenerate</button>
      <a href="${getImageUrl(post.image_url)}" download="Islamic_Post_${post.id}.png" class="btn btn-ghost btn-sm" target="_blank">📥 Download</a>
    </div>` : `
    <div class="post-actions">
      <button class="btn btn-ghost btn-sm" onclick="openEditModal(${post.id})">✏️ Edit</button>
      <button class="btn btn-ghost btn-sm" onclick="previewPost(${post.id})">👁️ Preview</button>
      <a href="${getImageUrl(post.image_url)}" download="Islamic_Post_${post.id}.png" class="btn btn-ghost btn-sm" target="_blank">📥 Download</a>
    </div>`;

  return `
    <div class="post-card" id="post-card-${post.id}">
      <div class="post-image">
        ${imageHtml}
        <span class="post-status-badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="post-body">
        <div class="post-tafseer" id="tafseer-${post.id}">
          <strong style="color:var(--accent-gold);display:block;margin-bottom:6px;font-family:'Inter',sans-serif;direction:ltr;text-align:left">📚 Tafseer / Reflection (تفسیر و فہم):</strong>
          ${escHtml(post.tafseer)}
        </div>
        <button class="read-more-btn" onclick="toggleTafseer(${post.id}, this)">Read more →</button>
        <div class="post-meta">
          <span>🕐 ${date}</span>
          <span style="color:var(--accent-gold)">ID #${post.id}</span>
        </div>
        ${actions}
      </div>
    </div>`;
}

function renderHistoryTable() {
  const tbody = document.getElementById("historyTableBody");
  if (allPosts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No posts yet. Generate your first post!</td></tr>`;
    return;
  }

  const approvedQueue = allPosts
    .filter((p) => p.status === "approved")
    .sort((a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at));

  tbody.innerHTML = allPosts.map((post) => {
    const date = new Date(post.created_at).toLocaleDateString("en-PK", { day:"numeric", month:"short", year:"numeric" });
    const statusClass = `badge-${post.status}`;
    let statusLabel = post.status.charAt(0).toUpperCase() + post.status.slice(1);

    if (post.status === "approved") {
      const qIndex = approvedQueue.findIndex((p) => p.id === post.id);
      statusLabel = qIndex >= 0 ? `Queued #${qIndex + 1} (FIFO)` : "Approved (In Queue)";
    }

    let statusSubtext = "";
    if (post.status === "published" && post.fb_post_id) {
      statusSubtext = `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">FB: ${escHtml(post.fb_post_id)}</div>`;
    }

    let rowActions = `<button class="btn btn-ghost btn-sm" onclick="openEditModal(${post.id})" title="Edit Post">✏️</button>`;
    rowActions += `<button class="btn btn-ghost btn-sm" onclick="previewPost(${post.id})" title="Preview">👁️</button>`;
    rowActions += `<a href="${getImageUrl(post.image_url)}" download="Islamic_Post_${post.id}.png" class="btn btn-ghost btn-sm" target="_blank" title="Download Image">📥</a>`;
    if (post.status === "pending") {
      rowActions += `
        <button class="btn btn-success btn-sm" onclick="approvePost(${post.id})" title="Approve">✅</button>
        <button class="btn btn-danger btn-sm" onclick="rejectPost(${post.id})" title="Reject">❌</button>`;
    } else if (post.status === "approved") {
      rowActions += `<button class="btn btn-primary btn-sm" onclick="publishPost(${post.id})" title="Publish">📤</button>`;
    }

    return `<tr id="row-${post.id}">
      <td style="color:var(--text-muted)">#${post.id}</td>
      <td>
        <div style="font-weight:600;font-size:13px">${escHtml(post.surah)}</div>
        <div style="font-size:11px;color:var(--text-muted)">Ayat ${escHtml(post.ayat_number)}</div>
      </td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font-size:12px">
        ${escHtml(post.tafseer.substring(0, 60))}...
      </td>
      <td>
        <span class="post-status-badge ${statusClass}" style="position:static">${statusLabel}</span>
        ${statusSubtext}
      </td>
      <td style="color:var(--text-muted);font-size:12px">${date}</td>
      <td><div style="display:flex;gap:6px">${rowActions}</div></td>
    </tr>`;
  }).join("");
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────
async function generatePost() {
  showLoader("✨ Generating Islamic post with AI...");
  try {
    const res = await fetch(`${API}/api/posts/generate`, { method: "POST" });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      showToast(`🌙 New post generated for ${data.post.surah}!`, "success");
      await Promise.all([loadStats(), loadPosts()]);
    } else {
      showToast(`❌ Error: ${data.error}`, "error");
    }
  } catch (e) {
    hideLoader();
    showToast("❌ Could not connect to server. Is it running?", "error");
  }
}

async function approvePost(id) {
  try {
    const res = await fetch(`${API}/api/posts/${id}/approve`, { method: "PUT" });
    const data = await res.json();
    if (data.success) {
      showToast("✅ Post approved! You can now publish it.", "success");
      await Promise.all([loadStats(), loadPosts()]);
      renderHistoryTable();
    }
  } catch (e) {
    showToast("❌ Failed to approve post", "error");
  }
}

async function rejectPost(id) {
  if (!confirm("Reject this post? It will be archived.")) return;
  try {
    const res = await fetch(`${API}/api/posts/${id}/reject`, { method: "PUT" });
    const data = await res.json();
    if (data.success) {
      showToast("Post rejected and archived.", "info");
      await Promise.all([loadStats(), loadPosts()]);
      renderHistoryTable();
    }
  } catch (e) {
    showToast("❌ Failed to reject post", "error");
  }
}

async function publishPost(id) {
  const post = allPosts.find((p) => p.id === id);
  const mockMode = settings.mock_mode === "true";
  const confirmMsg = mockMode
    ? "Publish in MOCK mode (no real Facebook post will be made)?"
    : "Publish this post to your Facebook Page? This cannot be undone.";

  if (!confirm(confirmMsg)) return;

  showLoader("📤 Publishing to Facebook...");
  try {
    const res = await fetch(`${API}/api/posts/${id}/publish`, { method: "POST" });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      const msg = data.mock
        ? "🎭 Mock published! (Enable real mode in Settings)"
        : `📘 Published to Facebook! Post ID: ${data.post_id}`;
      showToast(msg, "success");
      await Promise.all([loadStats(), loadPosts()]);
      renderHistoryTable();
    } else {
      showToast(`❌ Publish failed: ${data.error}`, "error");
    }
  } catch (e) {
    hideLoader();
    showToast("❌ Publish failed", "error");
  }
}

async function approveAll() {
  const pending = allPosts.filter((p) => p.status === "pending");
  if (pending.length === 0) { showToast("No pending posts to approve", "info"); return; }
  if (!confirm(`Approve all ${pending.length} pending posts?`)) return;

  for (const post of pending) {
    await fetch(`${API}/api/posts/${post.id}/approve`, { method: "PUT" });
  }
  showToast(`✅ ${pending.length} posts approved!`, "success");
  await Promise.all([loadStats(), loadPosts()]);
}

async function clearAllHistory() {
  if (!confirm("Are you sure you want to clear all posts history? This cannot be undone.")) return;
  showLoader("🗑️ Clearing all posts history...");
  try {
    const res = await fetch(`${API}/api/posts`, { method: "DELETE" });
    const data = await res.json();
    hideLoader();

    if (data.success) {
      showToast("🗑️ All posts history cleared!", "success");
      allPosts = [];
      await Promise.all([loadStats(), loadPosts()]);
      renderHistoryTable();
    } else {
      showToast(`❌ Error: ${data.error || "Failed to clear"}`, "error");
    }
  } catch (e) {
    hideLoader();
    showToast("❌ Could not connect to server", "error");
  }
}

async function regenerateImage(id) {
  showLoader("🖼️ Generating new composed image...");
  try {
    const res = await fetch(`${API}/api/posts/${id}/regenerate-image`, { method: "POST" });
    const data = await res.json();
    hideLoader();
    if (data.success) {
      showToast("🖼️ New composed image generated!", "success");
      await loadPosts();
    } else {
      showToast(`❌ ${data.error}`, "error");
    }
  } catch (e) {
    hideLoader();
    showToast("❌ Image regeneration failed", "error");
  }
}

function previewPost(id) {
  const post = allPosts.find((p) => p.id === id);
  if (!post) return;

  document.getElementById("modalContent").innerHTML = `
    <div style="margin-bottom:16px">
      ${post.image_url ? `<img src="${getImageUrl(post.image_url)}" style="width:100%;border-radius:12px;margin-bottom:16px" alt="Post image" onerror="this.style.display='none'" />` : ""}
      <div style="display:flex;gap:10px;margin-bottom:16px">
        <a href="${getImageUrl(post.image_url)}" download="Islamic_Post_${post.id}.png" class="btn btn-primary btn-sm" target="_blank">📥 Download Image</a>
        <button class="btn btn-ghost btn-sm" onclick="closeModal();openEditModal(${post.id})">✏️ Edit Content</button>
      </div>
      <div style="font-family:'Jameel Noori Nastaleeq', 'Noto Naskh Arabic', serif;direction:rtl;text-align:right;font-size:16px;color:var(--text-secondary);line-height:1.8;margin-bottom:14px;padding:12px;border-right:3px solid var(--accent-teal);padding-right:14px;background:rgba(255,255,255,0.03);border-radius:8px">
        <strong style="color:var(--accent-gold);display:block;margin-bottom:6px;font-family:'Inter',sans-serif;direction:ltr;text-align:left">📚 Tafseer / Reflection (تفسیر و فہم):</strong>
        ${escHtml(post.tafseer)}
      </div>
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.7;white-space:pre-line;margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border-radius:10px">
        <strong style="color:var(--text-secondary);display:block;margin-bottom:6px">📝 Facebook Caption:</strong>
        ${escHtml(post.caption)}
      </div>
      <div style="font-size:12px;color:var(--accent-teal)">${escHtml(post.hashtags)}</div>
    </div>
    ${post.status === "pending" ? `
    <div style="display:flex;gap:10px;border-top:1px solid var(--glass-border);padding-top:16px">
      <button class="btn btn-success" onclick="approvePost(${post.id});closeModal()">✅ Approve</button>
      <button class="btn btn-danger" onclick="rejectPost(${post.id});closeModal()">❌ Reject</button>
    </div>` : post.status === "approved" ? `
    <div style="border-top:1px solid var(--glass-border);padding-top:16px">
      <button class="btn btn-primary" onclick="publishPost(${post.id});closeModal()">📤 Publish to Facebook</button>
    </div>` : ""}`;

  document.getElementById("previewModal").classList.add("show");
}

function closeModal() {
  document.getElementById("previewModal").classList.remove("show");
}

// ── EDIT POST MODAL ──────────────────────────────────────────────────────────
function openEditModal(id) {
  const post = allPosts.find((p) => p.id === id);
  if (!post) return;

  document.getElementById("edit-post-id").value = post.id;
  document.getElementById("edit-ayat").value = post.ayat || "";
  document.getElementById("edit-surah").value = post.surah || "";
  document.getElementById("edit-ayat_number").value = post.ayat_number || "";
  document.getElementById("edit-urdu_translation").value = post.urdu_translation || "";
  document.getElementById("edit-tafseer").value = post.tafseer || "";
  document.getElementById("edit-caption").value = post.caption || "";
  document.getElementById("edit-hashtags").value = post.hashtags || "";

  const recomposeEl = document.getElementById("edit-recompose");
  if (recomposeEl) recomposeEl.checked = true;

  document.getElementById("editModal").classList.add("show");
}

function closeEditModal() {
  document.getElementById("editModal").classList.remove("show");
}

async function savePostEdit(event) {
  event.preventDefault();
  const id = document.getElementById("edit-post-id").value;
  if (!id) return;

  const payload = {
    ayat: document.getElementById("edit-ayat").value.trim(),
    surah: document.getElementById("edit-surah").value.trim(),
    ayat_number: document.getElementById("edit-ayat_number").value.trim(),
    urdu_translation: document.getElementById("edit-urdu_translation").value.trim(),
    tafseer: document.getElementById("edit-tafseer").value.trim(),
    caption: document.getElementById("edit-caption").value.trim(),
    hashtags: document.getElementById("edit-hashtags").value.trim(),
    recomposeImage: document.getElementById("edit-recompose")?.checked || false,
  };

  const saveBtn = document.getElementById("saveEditBtn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "⏳ Saving...";
  }

  showLoader("💾 Saving changes & re-rendering image...");
  try {
    const res = await fetch(`${API}/api/posts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    hideLoader();

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 Save Changes";
    }

    if (data.success) {
      showToast("✨ Post updated successfully!", "success");
      closeEditModal();
      await Promise.all([loadStats(), loadPosts()]);
      renderHistoryTable();
    } else {
      showToast(`❌ Error: ${data.error || "Failed to update"}`, "error");
    }
  } catch (e) {
    hideLoader();
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 Save Changes";
    }
    showToast("❌ Failed to update post", "error");
  }
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function applySettingsToForm(s) {
  const timeEl = document.getElementById("setting-schedule_time");
  if (timeEl && s.schedule_time) timeEl.value = s.schedule_time;

  const schedEl = document.getElementById("setting-schedule_enabled");
  if (schedEl) schedEl.checked = s.schedule_enabled !== "false";

  const pubTimeEl = document.getElementById("setting-publish_schedule_time");
  if (pubTimeEl && s.publish_schedule_time) pubTimeEl.value = s.publish_schedule_time;

  const pubSchedEl = document.getElementById("setting-publish_enabled");
  if (pubSchedEl) pubSchedEl.checked = s.publish_enabled !== "false";

  const mockEl = document.getElementById("setting-mock_mode");
  if (mockEl) mockEl.checked = s.mock_mode === "true";

  if (s.gemini_api_key && !s.gemini_api_key_masked) {
    const gEl = document.getElementById("setting-gemini_api_key");
    if (gEl) gEl.placeholder = "Already set (hidden)";
  }
  if (s.fb_page_id) {
    const pEl = document.getElementById("setting-fb_page_id");
    if (pEl) pEl.value = s.fb_page_id;
  }
}

async function saveSettings() {
  const payload = {
    schedule_time: document.getElementById("setting-schedule_time")?.value || "09:00",
    schedule_enabled: document.getElementById("setting-schedule_enabled")?.checked ? "true" : "false",
    publish_schedule_time: document.getElementById("setting-publish_schedule_time")?.value || "10:00",
    publish_enabled: document.getElementById("setting-publish_enabled")?.checked ? "true" : "false",
    mock_mode: document.getElementById("setting-mock_mode")?.checked ? "true" : "false",
    fb_page_id: document.getElementById("setting-fb_page_id")?.value.trim() || "",
  };

  const geminiKey = document.getElementById("setting-gemini_api_key")?.value.trim();
  if (geminiKey) payload.gemini_api_key = geminiKey;

  const fbToken = document.getElementById("setting-fb_access_token")?.value.trim();
  if (fbToken) payload.fb_access_token = fbToken;

  try {
    const res = await fetch(`${API}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      showToast("💾 Settings saved!", "success");
      await loadSettings();
      updateSchedulerStatus();
    }
  } catch (e) {
    showToast("❌ Failed to save settings", "error");
  }
}

async function validateFacebook() {
  const pageId = document.getElementById("setting-fb_page_id")?.value.trim();
  const token = document.getElementById("setting-fb_access_token")?.value.trim();

  if (!pageId || !token) {
    showToast("Please enter both Page ID and Access Token", "error");
    return;
  }

  document.getElementById("fbValidationResult").innerHTML = `<span style="color:var(--text-muted)">🔍 Validating...</span>`;
  document.getElementById("validateFbBtn").disabled = true;

  try {
    const res = await fetch(`${API}/api/settings/validate-facebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: pageId, access_token: token }),
    });
    const data = await res.json();
    document.getElementById("validateFbBtn").disabled = false;

    if (data.valid) {
      document.getElementById("fbValidationResult").innerHTML =
        `<span class="fb-connected">✅ Connected to "${escHtml(data.page_name)}" (${(data.followers || 0).toLocaleString()} followers)</span>`;
      showToast(`📘 Facebook connected: ${data.page_name}`, "success");
    } else {
      document.getElementById("fbValidationResult").innerHTML =
        `<span class="fb-disconnected">❌ ${escHtml(data.error || "Invalid credentials")}</span>`;
      showToast("❌ Facebook validation failed", "error");
    }
  } catch (e) {
    document.getElementById("validateFbBtn").disabled = false;
    document.getElementById("fbValidationResult").innerHTML =
      `<span class="fb-disconnected">❌ Connection error</span>`;
  }
}

function updateFbStatus(s) {
  const indicator = document.getElementById("fbStatusIndicator");
  if (!indicator) return;
  if (s.mock_mode === "true") {
    indicator.innerHTML = `<span style="font-size:12px;color:var(--accent-gold);background:rgba(212,175,55,0.1);padding:4px 10px;border-radius:20px;border:1px solid rgba(212,175,55,0.3)">🎭 Mock Mode</span>`;
  } else if (s.fb_page_id && s.fb_access_token) {
    indicator.innerHTML = `<span style="font-size:12px;color:var(--accent-green);background:rgba(16,185,129,0.1);padding:4px 10px;border-radius:20px;border:1px solid rgba(16,185,129,0.3)">📘 FB Connected</span>`;
  } else {
    indicator.innerHTML = `<span style="font-size:12px;color:var(--accent-red);background:rgba(239,68,68,0.1);padding:4px 10px;border-radius:20px;border:1px solid rgba(239,68,68,0.3)">⚠️ FB Not Configured</span>`;
  }
}

function updateSchedulerStatus() {
  const dot = document.getElementById("schedulerDot");
  const timeEl = document.getElementById("schedulerTime");
  const enabled = settings.schedule_enabled !== "false";
  const time = settings.schedule_time || "09:00";

  if (dot) {
    dot.className = "status-dot" + (enabled ? "" : " offline");
  }
  if (timeEl) {
    timeEl.textContent = enabled ? `Daily at ${time} PKT` : "Disabled";
  }
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function toggleTafseer(id, btn) {
  const el = document.getElementById(`tafseer-${id}`);
  if (el.classList.contains("expanded")) {
    el.classList.remove("expanded");
    btn.textContent = "Read more →";
  } else {
    el.classList.add("expanded");
    btn.textContent = "← Show less";
  }
}

function showLoader(text = "Loading...") {
  document.getElementById("loaderText").textContent = text;
  document.getElementById("loader").classList.add("show");
}

function hideLoader() {
  document.getElementById("loader").classList.remove("show");
}

function showToast(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(50px)"; }, 3500);
  setTimeout(() => toast.remove(), 3800);
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
