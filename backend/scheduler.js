const cron = require("node-cron");
const { generatePostContent, generateImage } = require("./aiGenerator");
const { createComposedImage } = require("./imageComposer");
const { queries, getSetting, getAllSettings } = require("./database");

let scheduledTask = null;

function buildCronExpression(timeStr) {
  // timeStr format: "HH:MM"
  const [hour, minute] = timeStr.split(":").map(Number);
  return `${minute} ${hour} * * *`;
}

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

function stopScheduler() {
  if (scheduledTask) {
    if (typeof scheduledTask.stop === "function") {
      scheduledTask.stop();
    } else if (typeof scheduledTask.destroy === "function") {
      scheduledTask.destroy();
    }
    scheduledTask = null;
    console.log("[Scheduler] Scheduler stopped.");
  }
}

function startScheduler() {
  const scheduleEnabled = getSetting("schedule_enabled");
  const scheduleTime = getSetting("schedule_time") || "09:00";

  stopScheduler();

  if (scheduleEnabled !== "true") {
    console.log("[Scheduler] Scheduler is disabled.");
    return;
  }

  const cronExpression = buildCronExpression(scheduleTime);
  console.log(`[Scheduler] Scheduling daily generation at ${scheduleTime} (cron: ${cronExpression})`);

  scheduledTask = cron.schedule(cronExpression, async () => {
    await runDailyGeneration();
  }, { timezone: "Asia/Karachi" });

  console.log(`[Scheduler] ✅ Scheduler started. Next post will be generated at ${scheduleTime} PKT.`);
}

function restartScheduler() {
  stopScheduler();
  startScheduler();
}

module.exports = { startScheduler, stopScheduler, restartScheduler, runDailyGeneration };
