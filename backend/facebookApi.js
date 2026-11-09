const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { getSetting } = require("./database");

const FB_API_VERSION = "v20.0";
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

async function getPageAccessToken(pageId, token) {
  try {
    const res = await axios.get(`${FB_BASE_URL}/${pageId}`, {
      params: { fields: "access_token", access_token: token },
      timeout: 10000,
    });
    if (res.data && res.data.access_token) {
      return res.data.access_token;
    }
  } catch (err) {
    // If token is already a page access token or fetch fails, fallback to input token
  }
  return token;
}

async function publishToFacebook(post) {
  const mockMode = getSetting("mock_mode") === "true";
  const pageId = getSetting("fb_page_id");
  const rawToken = getSetting("fb_access_token");

  if (mockMode || !pageId || !rawToken) {
    console.log("[MOCK] Would publish to Facebook:", {
      pageId,
      caption: post.caption?.substring(0, 100) + "...",
      imageUrl: post.image_url,
    });
    return {
      success: true,
      mock: true,
      post_id: `mock_${Date.now()}`,
      message: "Mock publish successful (Facebook not connected)",
    };
  }

  try {
    // Ensure we have the page-specific token
    const accessToken = await getPageAccessToken(pageId, rawToken);

    // Step 1: Upload photo using multipart form data (local file)
    const photoUrl = `${FB_BASE_URL}/${pageId}/photos`;
    const fullCaption = `${post.caption}\n\n${post.hashtags}`;

    const form = new FormData();
    form.append("caption", fullCaption);
    form.append("access_token", accessToken);

    let imagePath = post.image_local_path;
    if (!imagePath || !fs.existsSync(imagePath)) {
      const fileName = path.basename(post.image_url || `post_${post.id}.png`);
      const candidatePath = path.join(__dirname, "..", "frontend", "generated", fileName);
      if (fs.existsSync(candidatePath)) {
        imagePath = candidatePath;
      }
    }

    if (imagePath && fs.existsSync(imagePath)) {
      form.append("source", fs.createReadStream(imagePath));
    } else {
      throw new Error(`Image file not found on server for post #${post.id}`);
    }

    const response = await axios.post(photoUrl, form, {
      headers: form.getHeaders(),
      timeout: 60000,
    });

    if (response.data && response.data.post_id) {
      return {
        success: true,
        mock: false,
        post_id: response.data.post_id,
        message: "Successfully published to Facebook!",
      };
    }
    throw new Error("Unexpected Facebook API response");
  } catch (error) {
    const fbError = error.response?.data?.error;
    throw new Error(
      fbError
        ? `Facebook API Error: ${fbError.message} (Code: ${fbError.code})`
        : `Publish failed: ${error.message}`
    );
  }
}

async function validateFacebookToken(pageId, accessToken) {
  try {
    const response = await axios.get(`${FB_BASE_URL}/${pageId}`, {
      params: {
        fields: "id,name,fan_count",
        access_token: accessToken,
      },
      timeout: 10000,
    });
    return {
      valid: true,
      page_name: response.data.name,
      followers: response.data.fan_count,
    };
  } catch (error) {
    const fbError = error.response?.data?.error;
    return {
      valid: false,
      error: fbError?.message || error.message,
    };
  }
}

async function getFacebookPageInsights(pageId, accessToken) {
  try {
    const response = await axios.get(`${FB_BASE_URL}/${pageId}/insights`, {
      params: {
        metric: "page_impressions,page_engaged_users,page_post_engagements",
        period: "day",
        access_token: accessToken,
      },
      timeout: 10000,
    });
    return response.data;
  } catch {
    return null;
  }
}

module.exports = {
  publishToFacebook,
  validateFacebookToken,
  getFacebookPageInsights,
};
