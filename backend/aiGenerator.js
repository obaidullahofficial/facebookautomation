const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { getSetting } = require("./database");
const { createComposedImage } = require("./imageComposer");

// Islamic Ayat pool with authentic Urdu translations (no mixed English scrambling)
const AYAT_POOL = [
  { surah: "Al-Baqarah", number: "2:255", arabic: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ", ref: "Ayat ul Kursi", urdu: "اللہ وہ معبود برحق ہے جس کے سوا کوئی معبود نہیں، وہ زندہ اور سب کا نگہبان ہے" },
  { surah: "Al-Baqarah", number: "2:286", arabic: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا", ref: "Ease and mercy", urdu: "اللہ کسی جان پر اس کی طاقت سے زیادہ بوجھ نہیں ڈالتا" },
  { surah: "Al-Imran", number: "3:200", arabic: "يَا أَيُّهَا الَّذِينَ آمَنُوا اصْبِرُوا وَصَابِرُوا", ref: "Patience", urdu: "اے ایمان والو! صبر کرو، ثابت قدم رہو اور اللہ سے ڈرو تاکہ تم کامیاب ہو جاؤ" },
  { surah: "An-Nisa", number: "4:36", arabic: "وَاعْبُدُوا اللَّهَ وَلَا تُشْرِكُوا بِهِ شَيْئًا", ref: "Worship", urdu: "اور اللہ کی عبادت کرو اور اس کے ساتھ کسی کو شریک نہ ٹھهراؤ" },
  { surah: "Al-Maidah", number: "5:3", arabic: "الْيَوْمَ أَكْمَلْتُ لَكُمْ دِينَكُمْ", ref: "Perfection of Deen", urdu: "آج میں نے تمہارے لیے تمہارا دین مکمل کر دیا اور اپنی نعمت تم پر تمام کر دی" },
  { surah: "Al-Anfal", number: "8:2", arabic: "إِنَّمَا الْمُؤْمِنُونَ الَّذِينَ إِذَا ذُكِرَ اللَّهُ وَجِلَتْ قُلُوبُهُمْ", ref: "True believers", urdu: "سچے مومن تو وہی ہیں کہ جب اللہ کا ذکر کیا جائے تو ان کے دل دہل جاتے ہیں" },
  { surah: "Ibrahim", number: "14:7", arabic: "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ", ref: "Gratitude and increase", urdu: "اگر تم شکر ادا کرو گے تو میں تمہیں ضرور اور زیادہ دوں گا" },
  { surah: "Al-Hijr", number: "15:9", arabic: "إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ", ref: "Quran preserved", urdu: "بے شک ہم نے ہی اس قرآن کو نازل فرمایا اور ہم ہی اس کی حفاظت کرنے والے ہیں" },
  { surah: "Al-Isra", number: "17:9", arabic: "إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ", ref: "Guidance of Quran", urdu: "بے شک یہ قرآن اس راستے کی رہنمائی کرتا ہے جو سب سے سیدھا ہے" },
  { surah: "Al-Kahf", number: "18:10", arabic: "رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا", ref: "Dua for mercy", urdu: "اے ہمارے رب! ہمیں اپنے پاس سے رحمت عطا فرما اور ہمارے کام میں درست راہ مہیا فرما" },
  { surah: "Maryam", number: "19:96", arabic: "إِنَّ الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ سَيَجْعَلُ لَهُمُ الرَّحْمَٰنُ وُدًّا", ref: "Love from Allah", urdu: "بے شک جو لوگ ایمان لائے اور نیک عمل کیے، رحمان ان کے لیے دلوں میں محبت پیدا کر دے گا" },
  { surah: "Al-Anbiya", number: "21:107", arabic: "وَمَا أَرْسَلْنَاكَ إِلَّا رَحْمَةً لِّلْعَالَمِينَ", ref: "Mercy to worlds", urdu: "اور ہم نے آپ کو تمام جہانوں کے لیے رحمت بنا کر ہی بھیجا ہے" },
  { surah: "Al-Furqan", number: "25:63", arabic: "وَعِبَادُ الرَّحْمَٰنِ الَّذِينَ يَمْشُونَ عَلَى الْأَرْضِ هَوْنًا", ref: "Servants of Rahman", urdu: "اور رحمان کے بندے وہ ہیں جو زمین پر عاجزی کے ساتھ چلتے ہیں" },
  { surah: "Az-Zumar", number: "39:53", arabic: "لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ", ref: "Hope in Allah's mercy", urdu: "اللہ کی رحمت سے ناامید مت ہو، بے شک اللہ تمام گناہوں کو معاف فرما دیتا ہے" },
  { surah: "Al-Inshirah", number: "94:5-6", arabic: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا إِنَّ مَعَ الْعُسْرِ يُسْرًا", ref: "With hardship comes ease", urdu: "پس بے شک مشکل کے ساتھ آسانی ہے، بے شک مشکل کے ساتھ آسانی ہے" },
  { surah: "Al-Alaq", number: "96:1", arabic: "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ", ref: "First revelation", urdu: "پڑھیے اپنے رب کے نام سے جس نے پیدا کیا" },
  { surah: "Al-Ikhlas", number: "112:1-4", arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ", ref: "Oneness of Allah", urdu: "کہہ دیجیے کہ وہ اللہ ایک ہے، اللہ بے نیاز ہے" },
  { surah: "Al-Falaq", number: "113:1", arabic: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ", ref: "Protection from evil", urdu: "کہہ دیجیے کہ میں صبح کے رب کی پناہ مانگتا ہوں" },
  { surah: "An-Nas", number: "114:1", arabic: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ", ref: "Protection from whispers", urdu: "کہہ دیجیے کہ میں انسانوں کے پروردگار کی پناہ مانگتا ہوں" },
  { surah: "Al-Fatiha", number: "1:1-7", arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", ref: "Opening chapter", urdu: "سب تعریفیں اللہ ہی کے لیے ہیں جو تمام جہانوں کا پالنے والا ہے" },
  { surah: "Ar-Rahman", number: "55:13", arabic: "فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ", ref: "Blessings of Allah", urdu: "پس تم اپنے رب کی کون کون سی نعمتوں کو جھٹلاؤ گے" },
  { surah: "Al-Mulk", number: "67:2", arabic: "الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا", ref: "Life as a test", urdu: "جس نے موت اور زندگی کو پیدا کیا تاکہ تمہیں آزمائے کہ تم میں سے اچھے عمل والا کون ہے" },
  { surah: "Al-Qasas", number: "28:24", arabic: "رَبِّ إِنِّي لِمَا أَنزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ", ref: "Dua of Musa", urdu: "اے میرے رب! جو بھلائی بھی تو میری طرف نازل فرمائے، میں اس کا محتاج ہوں" },
  { surah: "Ash-Sharh", number: "94:1", arabic: "أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ", ref: "Expansion of the chest", urdu: "کیا ہم نے آپ کی خاطر آپ کا سینہ کشادہ نہیں فرما دیا" },
  { surah: "Al-Baqarah", number: "2:153", arabic: "يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ", ref: "Seek help through patience and prayer", urdu: "اے ایمان والو! صبر اور نماز کے ذریعے مدد طلب کرو، بے شک اللہ صبر کرنے والوں کے ساتھ ہے" },
  { surah: "Yunus", number: "10:62", arabic: "أَلَا إِنَّ أَوْلِيَاءَ اللَّهِ لَا خَوْفٌ عَلَيْهِمْ وَلَا هُمْ يَحْزَنُونَ", ref: "Friends of Allah", urdu: "یاد رکھو! اللہ کے دوستوں پر نہ کوئی خوف ہوگا اور نہ وہ غمگین ہوں گے" },
  { surah: "Ash-Shura", number: "42:30", arabic: "وَمَا أَصَابَكُم مِّن مُّصِيبَةٍ فَبِمَا كَسَبَتْ أَيْدِيكُمْ", ref: "Trials as consequences", urdu: "اور تمہیں جو مصیبت بھی پہنچتی ہے وہ تمہارے اپنے ہاتھوں کی کمائی کی وجہ سے ہے" },
  { surah: "Al-Hadid", number: "57:3", arabic: "هُوَ الْأَوَّلُ وَالْآخِرُ وَالظَّاهِرُ وَالْبَاطِنُ", ref: "Names of Allah", urdu: "وہی اول بھی ہے اور آخر بھی، اور ظاہر بھی ہے اور باطن بھی" },
  { surah: "At-Talaq", number: "65:3", arabic: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ", ref: "Tawakkul", urdu: "اور جو شخص اللہ پر بھروسہ کرے تو وہ اس کے لیے کافی ہے" },
  { surah: "Al-Muzzammil", number: "73:8", arabic: "وَاذْكُرِ اسْمَ رَبِّكَ وَتَبَتَّلْ إِلَيْهِ تَبْتِيلًا", ref: "Remembrance of Allah", urdu: "اور اپنے رب کے نام کا ذکر کیجیے اور سب سے کٹ کر اسی کے ہو رہیے" },
];

function getTodaysAyat(postCount) {
  const index = postCount % AYAT_POOL.length;
  return AYAT_POOL[index];
}

async function generatePostContent(geminiApiKey, postCount = 0) {
  const ayatData = getTodaysAyat(postCount);

  if (!geminiApiKey) {
    return generateMockContent(ayatData);
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an authentic Islamic scholar creating content for a Facebook page in Urdu. Create a beautiful, engaging post about this Quranic Ayat with the Tafseer / Reflection written entirely in pure, eloquent Urdu:

Surah: ${ayatData.surah}
Ayat Number: ${ayatData.number}
Arabic: ${ayatData.arabic}
Theme: ${ayatData.ref}
Urdu Translation: ${ayatData.urdu}

Please respond with ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "ayat": "${ayatData.arabic}",
  "surah": "${ayatData.surah}",
  "ayat_number": "${ayatData.number}",
  "urdu_translation": "${ayatData.urdu}",
  "tafseer": "تفسیر اور تدبر: سورۃ ${ayatData.surah} کی اس مبارک آیت کا مفہوم انتہائی گہرا اور دل کو چھونے والا ہے۔ اس میں اللہ تعالیٰ نے بندوں کو صبر، شکر، اور توکل کا درس دیا ہے جو کہ انسانی زندگی کے ہر موڑ پر رہنما ہے۔ ہمیں اس کلام پاک پر غور کر کے اپنی دنیا و آخرت سنوارنی چاہیے",
  "caption": "🌙 آج کی آیت | Ayat of the Day ✨\n\n﴿ ${ayatData.arabic} ﴾\n\nسورۃ ${ayatData.surah} - آیت ${ayatData.number}\n\n📖 ترجمہ: ${ayatData.urdu}\n\n💫 تفسیر اور تدبر: سورۃ ${ayatData.surah} کی اس مبارک آیت کا مفہوم انتہائی گہرا اور دل کو چھونے والا ہے۔ اس میں اللہ تعالیٰ نے بندوں کو صبر، شکر، اور توکل کا درس دیا ہے جو کہ انسانی زندگی کے ہر موڑ پر رہنما ہے۔ ہمیں اس کلام پاک پر غور کر کے اپنی دنیا و آخرت سنوارنی چاہیے\n\n🤲 دعا ہے کہ اللہ تعالی ہمیں اس پر عمل کرنے کی توفیق عطا فرمائے۔ آمین!\n\nآپ کے نزدیک اس آیت کا کیا درس ہے؟ کمنٹ میں ضرور بتائیں 👇",
  "hashtags": "#QuranDaily #IslamicPost #QuranicWisdom #IslamicQuotes #Quran #Islam #DailyIslam #QuranicVerse #قرآن #اسلام",
  "image_prompt": "Serene Islamic art background with tulip corner accent"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse Gemini response as JSON");
      }
    }

    return {
      ayat: parsed.ayat || ayatData.arabic,
      surah: parsed.surah || ayatData.surah,
      ayat_number: parsed.ayat_number || ayatData.number,
      urdu_translation: parsed.urdu_translation || ayatData.urdu,
      tafseer: parsed.tafseer,
      caption: parsed.caption,
      hashtags: parsed.hashtags,
      image_prompt: parsed.image_prompt,
    };
  } catch (error) {
    console.error("Gemini API error:", error.message);
    console.log("Falling back to mock content...");
    return generateMockContent(ayatData);
  }
}

function generateMockContent(ayatData) {
  return {
    ayat: ayatData.arabic,
    surah: ayatData.surah,
    ayat_number: ayatData.number,
    urdu_translation: ayatData.urdu,
    tafseer: `تفسیر و فہم: سورۃ ${ayatData.surah} کی یہ مبارک آیت ہمیں صبر، شکر اور اللہ تعالیٰ کی حکمت کا درس دیتی ہے۔ ${ayatData.urdu} کے تحت یہ آیت انسان کو زندگی کے ہر قدم پر توکل اور استقامت کی تلقین کرتی ہے۔`,
    caption: `🌙 آج کی آیت | Ayat of the Day ✨\n\n﴿ ${ayatData.arabic} ﴾\n\nسورۃ ${ayatData.surah} - آیت ${ayatData.number}\n\n📖 ترجمہ: ${ayatData.urdu}\n\n💫 تفسیر و فہم: سورۃ ${ayatData.surah} کی یہ مبارک آیت ہمیں صبر، شکر اور اللہ تعالیٰ کی حکمت کا درس دیتی ہے۔ ${ayatData.urdu} کے تحت یہ آیت انسان کو زندگی کے ہر قدم پر توکل اور استقامت کی تلقین کرتی ہے۔\n\n🤲 دعا ہے کہ اللہ تعالی ہمیں اس پر عمل کرنے کی توفیق عطا فرمائے۔ آمین!\n\nآپ کے نزدیک اس آیت کا کیا درس ہے؟ کمنٹ میں ضرور بتائیں 👇`,
    hashtags: "#QuranDaily #IslamicPost #QuranicWisdom #IslamicQuotes #Quran #Islam #DailyIslam #QuranicVerse #قرآن #اسلام",
    image_prompt: "Serene Islamic art background with tulip corner accent",
  };
}

async function generateImage(imagePrompt, postData = {}) {
  return await createComposedImage(postData);
}

module.exports = { generatePostContent, generateImage, AYAT_POOL };
