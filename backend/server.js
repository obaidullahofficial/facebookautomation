require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const path = require("path");
const { queries, getSetting, getAllSettings, setSetting } = require("./database");
const { generatePostContent, generateImage } = require("./aiGenerator");
const { publishToFacebook, validateFacebookToken } = require("./facebookApi");
const { startScheduler, restartScheduler, runDailyGeneration } = require("./scheduler");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ─── POSTS API ───────────────────────────────────────────────────────────────

// GET all posts
app.get("/api/posts", (req, res) => {
  try {
    const posts = queries.getAllPosts.all();
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET pending posts only
app.get("/api/posts/pending", (req, res) => {
  try {
    const posts = queries.getPendingPosts.all();
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET stats
app.get("/api/stats", (req, res) => {
  try {
    const stats = queries.getStats.get();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST generate new post manually
app.post("/api/posts/generate", async (req, res) => {
  try {
    console.log("[API] Manual post generation triggered...");
    const result = await runDailyGeneration();
    if (result.success) {
      const post = queries.getPostById.get(result.postId);
      res.json({ success: true, post, message: "New Islamic post generated!" });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT approve post
app.put("/api/posts/:id/approve", (req, res) => {
  try {
    const { id } = req.params;
    queries.updatePostStatus.run("approved", id);
    const post = queries.getPostById.get(id);
    res.json({ success: true, post, message: "Post approved!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT reject post
app.put("/api/posts/:id/reject", (req, res) => {
  try {
    const { id } = req.params;
    queries.updatePostStatus.run("rejected", id);
    const post = queries.getPostById.get(id);
    res.json({ success: true, post, message: "Post rejected." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT edit post content (Ayat, translation, tafseer, caption, etc.)
app.put("/api/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const existing = queries.getPostById.get(id);
    if (!existing) return res.status(404).json({ success: false, error: "Post not found" });

    const updates = req.body;
    let post = queries.updatePost.run(id, updates);

    // If text on image changed, re-render the composed picture
    const textOnImageChanged =
      (updates.ayat && updates.ayat !== existing.ayat) ||
      (updates.surah && updates.surah !== existing.surah) ||
      (updates.ayat_number && updates.ayat_number !== existing.ayat_number) ||
      (updates.urdu_translation && updates.urdu_translation !== existing.urdu_translation) ||
      updates.recomposeImage === true;

    if (textOnImageChanged) {
      try {
        const { createComposedImage } = require("./imageComposer");
        const newImg = await createComposedImage(post);
        post = queries.updatePost.run(id, {
          image_url: newImg.url,
          image_local_path: newImg.local_path || "",
        });
      } catch (imgErr) {
        console.error("Failed to recompose image on edit:", imgErr.message);
      }
    }

    res.json({ success: true, post, message: "Post updated successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST publish approved post to Facebook
app.post("/api/posts/:id/publish", async (req, res) => {
  try {
    const { id } = req.params;
    const post = queries.getPostById.get(id);

    if (!post) return res.status(404).json({ success: false, error: "Post not found" });
    if (post.status === "published") {
      return res.status(400).json({ success: false, error: "Post is already published to Facebook" });
    }
    if (post.status === "pending") {
      queries.updatePostStatus.run("approved", id);
      post.status = "approved";
    }

    const result = await publishToFacebook(post);

    if (result.success) {
      queries.updatePostPublished.run(result.post_id, id);
      res.json({
        success: true,
        mock: result.mock,
        post_id: result.post_id,
        message: result.message,
      });
    } else {
      res.status(500).json({ success: false, error: result.error || "Publish failed" });
    }
  } catch (error) {
    console.error("Publish error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST regenerate image for a post
app.post("/api/posts/:id/regenerate-image", async (req, res) => {
  try {
    const { id } = req.params;
    const post = queries.getPostById.get(id);
    if (!post) return res.status(404).json({ success: false, error: "Post not found" });

    const image = await generateImage(post.caption, post);
    queries.updatePostImage.run(image.url, image.local_path || "", id);
    res.json({ success: true, image_url: image.url });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── SETTINGS API ────────────────────────────────────────────────────────────

// GET all settings
app.get("/api/settings", (req, res) => {
  try {
    const settings = getAllSettings();
    // Mask sensitive keys partially
    if (settings.fb_access_token && settings.fb_access_token.length > 10) {
      settings.fb_access_token_masked =
        settings.fb_access_token.substring(0, 8) + "..." + settings.fb_access_token.slice(-4);
    }
    if (settings.gemini_api_key && settings.gemini_api_key.length > 10) {
      settings.gemini_api_key_masked =
        settings.gemini_api_key.substring(0, 8) + "..." + settings.gemini_api_key.slice(-4);
    }
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update settings
app.put("/api/settings", (req, res) => {
  try {
    const updates = req.body;
    const allowedKeys = [
      "schedule_time",
      "schedule_enabled",
      "fb_page_id",
      "fb_access_token",
      "gemini_api_key",
      "mock_mode",
      "setup_complete",
    ];

    allowedKeys.forEach((key) => {
      if (updates[key] !== undefined) {
        setSetting(key, updates[key]);
      }
    });

    // Restart scheduler if time changed
    if (updates.schedule_time || updates.schedule_enabled !== undefined) {
      restartScheduler();
    }

    res.json({ success: true, message: "Settings saved!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST validate Facebook credentials
app.post("/api/settings/validate-facebook", async (req, res) => {
  try {
    const { page_id, access_token } = req.body;
    const result = await validateFacebookToken(page_id, access_token);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── CATCH-ALL ───────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n`);
  console.log(`  🌙 ═══════════════════════════════════════════════ 🌙`);
  console.log(`  ✨   Islamic Facebook Automation Dashboard          ✨`);
  console.log(`  🌙 ═══════════════════════════════════════════════ 🌙`);
  console.log(`\n  🚀 Server running at: http://localhost:${PORT}`);
  console.log(`  📋 API available at:  http://localhost:${PORT}/api`);
  console.log(`\n`);
  startScheduler();
});
