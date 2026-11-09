const cron = require("node-cron");
const { generatePostContent } = require("./aiGenerator");
const { createComposedImage } = require("./imageComposer");
const { publishToFacebook } = require("./facebookApi");
const { queries, getSetting } = require("./database");

let publishingTask = null;

function buildCronExpression(timeStr) {
  // timeStr format: "HH:MM"
  const [hour, minute] = (timeStr || "09:00").split(":").map(Number);
  return `${minute} ${hour} * * *`;
}

/**
 * 1. Manual Post Generation Process
 * Called on demand when user clicks "✨ Generate Now" button in the portal.
 * Generates a new Islamic post and saves as PENDING in Approval Queue.
 */
async function runDailyGeneration() {
  console.log(`\n[Scheduler] Starting manual Islamic post generation at ${new Date().toISOString()}`);

  try {
    const geminiApiKey = getSetting("gemini_api_key") || "";
    const allPosts = queries.getAllPosts.all();
    const postCount = allPosts.length;

    console.log(`[Scheduler] Generating post #${postCount + 1}...`);

    // Generate content
    const content = await generatePostContent(geminiApiKey, postCount);
    console.log(`[Scheduler] Content generated for Surah ${content.surah} - Ayat ${content.ayat_number}`);

    // Create post in DB first to get ID
    const result = queries.createPost.run({
      ayat: content.ayat,
      surah: content.surah,
      ayat_number: content.ayat_number,
      urdu_translation: content.urdu_translation,
      tafseer: content.tafseer,
      caption: content.caption,
      hashtags: content.hashtags,
      image_url: "",
      image_local_path: "",
      scheduled_for: new Date().toISOString(),
    });

    const postId = result.lastInsertRowid;

    // Generate composed image with this post ID
    const image = await createComposedImage({ ...content, id: postId });
    queries.updatePostImage.run(image.url, image.local_path || "", postId);

    console.log(`[Scheduler] Image generated: ${image.url}`);
    console.log(`[Scheduler] Post saved with ID: ${postId}`);
    console.log(`[Scheduler] Post is PENDING approval in the dashboard.\n`);

    return { success: true, postId };
  } catch (error) {
    console.error(`[Scheduler] Generation failed:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 2. FIFO Publishing Process (Controlled by Settings Time)
 * Runs automatically at the configured daily publishing time.
 * - Follows First-In, First-Out (FIFO): oldest approved post is published first.
 * - Publishes exactly one approved post per scheduled interval.
 * - If no approved posts are available in queue, silently skips that publishing time.
 * - On success, sets status to PUBLISHED and stores fb_post_id.
 */
async function runScheduledPublishing() {
  console.log(`\n[Scheduler] Running scheduled FIFO publishing check at ${new Date().toISOString()}...`);
  try {
    const approvedPosts = queries.getApprovedPosts.all();

    if (approvedPosts.length === 0) {
      console.log(`[Scheduler] ℹ️ Publishing queue is empty (no approved posts awaiting publishing). Skipping this publishing interval.`);
      return { success: true, published: false, skipped: true, message: "No approved posts in queue. Skipped interval." };
    }

    // FIFO: Pick the oldest approved post
    const postToPublish = approvedPosts[0];
    console.log(
      `[Scheduler] 🚀 Found ${approvedPosts.length} approved post(s) in queue. Publishing oldest approved post ID #${postToPublish.id} (${postToPublish.surah} • Ayat ${postToPublish.ayat_number}) in FIFO order...`
    );

    const result = await publishToFacebook(postToPublish);

    if (result.success) {
      // Mark as published and store the Facebook post ID
      queries.updatePostPublished.run(result.post_id, postToPublish.id);
      console.log(
        `[Scheduler] ✅ Successfully published post #${postToPublish.id} to Facebook! FB Post ID: ${result.post_id}\n`
      );
      return {
        success: true,
        published: true,
        postId: postToPublish.id,
        fb_post_id: result.post_id,
        mock: result.mock,
      };
    } else {
      console.error(`[Scheduler] ❌ Failed to publish post #${postToPublish.id}:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error(`[Scheduler] Scheduled publishing error:`, error.message);
    return { success: false, error: error.message };
  }
}

function stopScheduler() {
  if (publishingTask) {
    if (typeof publishingTask.stop === "function") publishingTask.stop();
    else if (typeof publishingTask.destroy === "function") publishingTask.destroy();
    publishingTask = null;
  }
  console.log("[Scheduler] Publishing scheduler stopped.");
}

function startScheduler() {
  const publishEnabled = getSetting("schedule_enabled") !== "false";
  const publishTime = getSetting("schedule_time") || "09:00";

  stopScheduler();

  if (!publishEnabled) {
    console.log("[Scheduler] Auto-publishing is disabled in Settings.");
    return;
  }

  const pubCron = buildCronExpression(publishTime);
  console.log(`[Scheduler] 🚀 Daily Facebook Auto-Publishing (FIFO) scheduled at ${publishTime} PKT (cron: ${pubCron})`);

  publishingTask = cron.schedule(
    pubCron,
    async () => {
      await runScheduledPublishing();
    },
    { timezone: "Asia/Karachi" }
  );

  console.log(`[Scheduler] ✅ Auto-publishing scheduler active.`);
}

function restartScheduler() {
  stopScheduler();
  startScheduler();
}

module.exports = {
  startScheduler,
  stopScheduler,
  restartScheduler,
  runDailyGeneration,
  runScheduledPublishing,
};
