const cron = require("node-cron");
const { generatePostContent } = require("./aiGenerator");
const { createComposedImage } = require("./imageComposer");
const { publishToFacebook } = require("./facebookApi");
const { queries, getSetting } = require("./database");

let generationTask = null;
let publishingTask = null;

function buildCronExpression(timeStr) {
  // timeStr format: "HH:MM"
  const [hour, minute] = timeStr.split(":").map(Number);
  return `${minute} ${hour} * * *`;
}

/**
 * 1. Post Generation Process
 * Automatically generates a new Islamic post based on scheduled interval and saves as PENDING.
 * This process is completely separate from publishing.
 */
async function runDailyGeneration() {
  console.log(`\n[Scheduler] Starting daily Islamic post generation at ${new Date().toISOString()}`);

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
 * 2. FIFO Publishing Process
 * Checks the publishing queue (approved posts in History).
 * Publishes the oldest approved post (First-In, First-Out).
 * Only one post is published per interval.
 * Once published, sets status to PUBLISHED and saves fb_post_id to prevent duplicates.
 */
async function runScheduledPublishing() {
  console.log(`\n[Scheduler] Running scheduled FIFO publishing check at ${new Date().toISOString()}...`);
  try {
    const approvedPosts = queries.getApprovedPosts.all();

    if (approvedPosts.length === 0) {
      console.log(`[Scheduler] Publishing queue is empty (no approved posts awaiting publishing).`);
      return { success: true, published: false, message: "No approved posts in queue" };
    }

    // FIFO: Pick the oldest approved post
    const postToPublish = approvedPosts[0];
    console.log(
      `[Scheduler] Found ${approvedPosts.length} post(s) in queue. Publishing oldest approved post ID #${postToPublish.id} (${postToPublish.surah} • Ayat ${postToPublish.ayat_number})...`
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
  if (generationTask) {
    if (typeof generationTask.stop === "function") generationTask.stop();
    else if (typeof generationTask.destroy === "function") generationTask.destroy();
    generationTask = null;
  }
  if (publishingTask) {
    if (typeof publishingTask.stop === "function") publishingTask.stop();
    else if (typeof publishingTask.destroy === "function") publishingTask.destroy();
    publishingTask = null;
  }
  console.log("[Scheduler] Schedulers stopped.");
}

function startScheduler() {
  const scheduleEnabled = getSetting("schedule_enabled") !== "false";
  const scheduleTime = getSetting("schedule_time") || "09:00";

  const publishEnabled = getSetting("publish_enabled") !== "false";
  const publishTime = getSetting("publish_schedule_time") || "10:00";

  stopScheduler();

  // 1. Post Generation Scheduler
  if (scheduleEnabled) {
    const genCron = buildCronExpression(scheduleTime);
    console.log(`[Scheduler] ⏰ Auto-generation scheduled daily at ${scheduleTime} PKT (cron: ${genCron})`);
    generationTask = cron.schedule(
      genCron,
      async () => {
        await runDailyGeneration();
      },
      { timezone: "Asia/Karachi" }
    );
  } else {
    console.log("[Scheduler] Auto-generation is disabled.");
  }

  // 2. FIFO Post Publishing Scheduler
  if (publishEnabled) {
    const pubCron = buildCronExpression(publishTime);
    console.log(`[Scheduler] 🚀 Auto-publishing (FIFO) scheduled daily at ${publishTime} PKT (cron: ${pubCron})`);
    publishingTask = cron.schedule(
      pubCron,
      async () => {
        await runScheduledPublishing();
      },
      { timezone: "Asia/Karachi" }
    );
  } else {
    console.log("[Scheduler] Auto-publishing is disabled.");
  }

  console.log(`[Scheduler] ✅ Schedulers active and running.`);
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
