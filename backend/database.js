/**
 * Pure JSON flat-file database (no native modules required).
 * Data is stored in /data/db.json
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE  = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Seed ──────────────────────────────────────────────────────────────────────
const DEFAULT_DB = {
  posts: [],
  settings: {
    schedule_time: "09:00",
    schedule_enabled: "true",
    fb_page_id: "",
    fb_access_token: "",
    gemini_api_key: "",
    mock_mode: "true",
    setup_complete: "false",
  },
  _nextId: 1,
};

// ── Read / Write ──────────────────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    writeDB(DEFAULT_DB);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    writeDB(DEFAULT_DB);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

// ── Settings helpers ──────────────────────────────────────────────────────────
function getSetting(key) {
  const db = readDB();
  return db.settings[key] ?? null;
}

function getAllSettings() {
  return readDB().settings;
}

function setSetting(key, value) {
  const db = readDB();
  db.settings[key] = String(value);
  writeDB(db);
}

// ── Post helpers ──────────────────────────────────────────────────────────────
function getAllPosts() {
  const db = readDB();
  return [...db.posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100);
}

function getPendingPosts() {
  return getAllPosts().filter((p) => p.status === "pending");
}

function getPostById(id) {
  const db = readDB();
  return db.posts.find((p) => p.id === Number(id)) ?? null;
}

function createPost(data) {
  const db = readDB();
  const id = db._nextId++;
  const now = new Date().toISOString();
  const post = {
    id,
    ayat: data.ayat,
    surah: data.surah,
    ayat_number: data.ayat_number,
    urdu_translation: data.urdu_translation,
    tafseer: data.tafseer,
    caption: data.caption,
    hashtags: data.hashtags,
    image_url: data.image_url || "/Elegant_Maroon_Tulip_Corner_Accents_with_bgc_6_cropped.png",
    image_local_path: data.image_local_path || "",
    status: "pending",
    scheduled_for: data.scheduled_for || now,
    published_at: null,
    fb_post_id: null,
    created_at: now,
    updated_at: now,
  };
  db.posts.push(post);
  writeDB(db);
  return { lastInsertRowid: id };
}

function updatePostStatus(status, id) {
  const db = readDB();
  const post = db.posts.find((p) => p.id === Number(id));
  if (post) { post.status = status; post.updated_at = new Date().toISOString(); }
  writeDB(db);
}

function updatePostPublished(fbPostId, id) {
  const db = readDB();
  const post = db.posts.find((p) => p.id === Number(id));
  if (post) {
    post.status = "published";
    post.fb_post_id = fbPostId;
    post.published_at = new Date().toISOString();
    post.updated_at = new Date().toISOString();
  }
  writeDB(db);
}

function updatePostImage(imageUrl, localPath, id) {
  const db = readDB();
  const post = db.posts.find((p) => p.id === Number(id));
  if (post) {
    post.image_url = imageUrl;
    post.image_local_path = localPath || "";
    post.updated_at = new Date().toISOString();
  }
  writeDB(db);
}

function getStats() {
  const posts = getAllPosts();
  return {
    total: posts.length,
    pending:   posts.filter((p) => p.status === "pending").length,
    approved:  posts.filter((p) => p.status === "approved").length,
    rejected:  posts.filter((p) => p.status === "rejected").length,
    published: posts.filter((p) => p.status === "published").length,
  };
}

// Keep the same `queries` interface server.js expects
const queries = {
  getAllPosts:         { all: getAllPosts },
  getPendingPosts:    { all: getPendingPosts },
  getPostById:        { get: getPostById },
  createPost:         { run: createPost },
  updatePostStatus:   { run: updatePostStatus },
  updatePostPublished:{ run: updatePostPublished },
  updatePostImage:    { run: updatePostImage },
  getStats:           { get: getStats },
};

module.exports = { queries, getSetting, getAllSettings, setSetting };
