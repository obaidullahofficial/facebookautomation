const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const BG_IMAGE_PATH = path.join(__dirname, "..", "Elegant_Maroon_Tulip_Corner_Accents_with_bgc_6_cropped.png");
const OUTPUT_DIR = path.join(__dirname, "..", "frontend", "generated");
const FONT_PATH = path.join(__dirname, "..", "fonts", "JameelNooriNastaleeq.ttf");
const QWBW_FONT_PATH = path.join(__dirname, "..", "fonts", "Naskh-Nastaleeq-IndoPak-QWBW.ttf");

const AMIRI_BOLD_PATH = path.join(__dirname, "..", "fonts", "Amiri-Bold.ttf");
const SCHEHERAZADE_PATH = path.join(__dirname, "..", "fonts", "ScheherazadeNew-Bold.ttf");

// Register fonts
if (fs.existsSync(FONT_PATH)) {
  GlobalFonts.registerFromPath(FONT_PATH, "Jameel Noori Nastaleeq");
}
if (fs.existsSync(QWBW_FONT_PATH)) {
  GlobalFonts.registerFromPath(QWBW_FONT_PATH, "Naskh-Nastaleeq-IndoPak-QWBW");
  GlobalFonts.registerFromPath(QWBW_FONT_PATH, "Indopak Nastaleeq");
}
if (fs.existsSync(AMIRI_BOLD_PATH)) {
  GlobalFonts.registerFromPath(AMIRI_BOLD_PATH, "Amiri");
}
if (fs.existsSync(SCHEHERAZADE_PATH)) {
  GlobalFonts.registerFromPath(SCHEHERAZADE_PATH, "Scheherazade New");
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function wrapText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

async function createComposedImage(post) {
  try {
    const width = 1080;
    const height = 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // 1. Draw base background image
    if (fs.existsSync(BG_IMAGE_PATH)) {
      const bgImg = await loadImage(BG_IMAGE_PATH);
      ctx.drawImage(bgImg, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#f7f3ec";
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Translucent elegant content card
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.90)";
    ctx.shadowColor = "rgba(74, 14, 23, 0.14)";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.roundRect(90, 130, 900, 820, 24);
    ctx.fill();

    // Inner gold border
    ctx.strokeStyle = "rgba(184, 134, 11, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(110, 150, 860, 780, 16);
    ctx.stroke();

    // Outer subtle border
    ctx.strokeStyle = "rgba(74, 14, 23, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(104, 144, 872, 792, 18);
    ctx.stroke();
    ctx.restore();

    // 3. Bismillah header
    ctx.fillStyle = "#8c5d1e"; // Deep warm gold
    ctx.font = "bold 34px 'Naskh-Nastaleeq-IndoPak-QWBW', 'Jameel Noori Nastaleeq', 'Arabic Typesetting', Arial";
    ctx.textAlign = "center";
    ctx.fillText("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", width / 2, 215);

    // 4. Subtitle tag
    ctx.fillStyle = "#a3702c";
    ctx.font = "bold 16px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("—  AYAT OF THE DAY  —", width / 2, 255);

    // 5. Arabic Ayat text using Amiri Quran font
    ctx.fillStyle = "#4a0e17"; // Maroon matching the tulips
    const arabicFont = "bold 52px 'Amiri', 'Scheherazade New', 'Arabic Typesetting', Arial";
    ctx.font = arabicFont;
    ctx.textAlign = "center";

    const arabicText = post.ayat || "";
    const arabicLines = wrapText(ctx, arabicText, 760, arabicFont);
    let startY = 340;
    const lineHeight = 72;

    arabicLines.forEach((line, index) => {
      ctx.fillText(line, width / 2, startY + (index * lineHeight));
    });

    // 6. Surah & Ayat reference (compact, elegant size)
    let currentY = startY + (arabicLines.length * lineHeight) + 20;
    ctx.fillStyle = "#8c5d1e";
    ctx.font = "600 18px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(`Surah ${post.surah || ""} • Ayat ${post.ayat_number || ""}`, width / 2, currentY);

    // 7. Ornate Divider
    currentY += 36;
    ctx.strokeStyle = "rgba(140, 93, 30, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(260, currentY);
    ctx.lineTo(490, currentY);
    ctx.stroke();

    ctx.fillStyle = "#8c5d1e";
    ctx.font = "18px 'Segoe UI', Arial";
    ctx.fillText("◈", width / 2, currentY + 6);

    ctx.beginPath();
    ctx.moveTo(590, currentY);
    ctx.lineTo(820, currentY);
    ctx.stroke();

    // 8. Urdu Translation with Jameel Noori Nastaleeq
    currentY += 56;
    ctx.fillStyle = "#2b1f1d";
    const urduFont = "34px 'Jameel Noori Nastaleeq', 'Naskh-Nastaleeq-IndoPak-QWBW', Arial";
    ctx.font = urduFont;

    let urduText = post.urdu_translation || "";
    if (urduText && !urduText.startsWith("ترجمہ")) {
      urduText = `ترجمہ: ${urduText}`;
    }

    const urduLines = wrapText(ctx, urduText, 760, urduFont);
    const urduLineHeight = 52;

    urduLines.forEach((line, index) => {
      ctx.fillText(line, width / 2, currentY + (index * urduLineHeight));
    });

    // 9. Footer branding
    ctx.fillStyle = "#8c5d1e";
    ctx.font = "bold 20px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("Obaidullah", width / 2, 900);

    // Save output
    const fileName = `post_${post.id || Date.now()}.png`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(filePath, buffer);

    return {
      url: `/generated/${fileName}`,
      local_path: filePath,
    };
  } catch (error) {
    console.error("Error creating composed image:", error);
    return {
      url: "/Elegant_Maroon_Tulip_Corner_Accents_with_bgc_6_cropped.png",
      local_path: "",
    };
  }
}

module.exports = { createComposedImage };
