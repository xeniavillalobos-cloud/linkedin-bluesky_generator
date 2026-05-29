/**
 * LinkedIn → BlueSky & LinkedIn Post Generator
 * --------------------------------------------
 * 1. Scrapes LinkedIn posts from a profile via Apify
 * 2. Sends them to Claude AI for post suggestions
 * 3. Saves results to a Markdown file + optionally emails them
 *
 * Usage:
 *   node index.js --profile "https://www.linkedin.com/in/yourbosspublicprofile"
 *   node index.js --profile "https://www.linkedin.com/in/yourbosspublicprofile" --count 5
 */

import Anthropic from "@anthropic-ai/sdk";
import { ApifyClient } from "apify-client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── CONFIG ────────────────────────────────────────────────────────────────

const CONFIG = {
  // How many LinkedIn posts to fetch and analyse
  postsToFetch: 10,

  // How many BlueSky suggestions to generate
  blueskySuggestions: 5,

  // How many LinkedIn-style reposts to generate
  linkedinSuggestions: 3,

  // Writing style for generated posts
  postStyle: "thought leadership", // options: "thought leadership" | "casual" | "hot takes" | "educational"

  // Output folder for saved reports
  outputDir: "./reports",
};

// ─── HELPERS ───────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--profile") result.profile = args[i + 1];
    if (args[i] === "--count") result.count = parseInt(args[i + 1]);
    if (args[i] === "--style") result.style = args[i + 1];
  }
  return result;
}

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`);
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function ensureOutputDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── STEP 1: SCRAPE LINKEDIN VIA APIFY ────────────────────────────────────

async function scrapeLinkedInPosts(profileUrl, maxPosts) {
  log("🔍", `Scraping LinkedIn profile: ${profileUrl}`);

  const apiToken = process.env.APIFY_API_TOKEN;
  if (!apiToken) throw new Error("Missing APIFY_API_TOKEN in environment variables.");

  const client = new ApifyClient({ token: apiToken });

  // Using Apify's LinkedIn Profile Scraper actor
  const run = await client.actor("anchor/linkedin-profile-scraper").call({
    profileUrls: [profileUrl],
    maxPostCount: maxPosts,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  if (!items || items.length === 0) {
    throw new Error("No data returned from Apify. Check the profile URL and your API token.");
  }

  // Extract posts from the response
  const profile = items[0];
  const posts = (profile.posts || []).slice(0, maxPosts);

  if (posts.length === 0) {
    throw new Error(
      "Profile found but no posts returned. The profile may be private or have no recent posts."
    );
  }

  log("✅", `Found ${posts.length} LinkedIn posts from ${profile.fullName || profileUrl}`);

  return {
    name: profile.fullName || "Unknown",
    headline: profile.headline || "",
    posts: posts.map((p) => ({
      text: p.text || p.commentary || "",
      date: p.postedAt || p.date || "",
      likes: p.likeCount || 0,
      comments: p.commentCount || 0,
    })),
  };
}

// ─── STEP 2: GENERATE POSTS WITH CLAUDE ───────────────────────────────────

async function generatePosts(profileData, style, bsCount, liCount) {
  log("🤖", "Sending posts to Claude for analysis...");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY in environment variables.");

  const client = new Anthropic({ apiKey });

  const postsText = profileData.posts
    .map(
      (p, i) =>
        `Post ${i + 1} (${p.date}, ${p.likes} likes):\n${p.text}`
    )
    .join("\n\n---\n\n");

  const prompt = `You are a social media strategist. Below are recent LinkedIn posts from ${profileData.name} (${profileData.headline}).

Your job is to:
1. Generate ${bsCount} BlueSky post suggestions inspired by these posts
2. Generate ${liCount} LinkedIn post suggestions that could complement this person's content

---
LINKEDIN POSTS:
${postsText}
---

RULES FOR BLUESKY POSTS:
- Max 300 characters each (hard limit)
- Direct, human, no corporate fluff
- No "thrilled to share" or "excited to announce"
- Vary the angle: insights, questions, hot takes, stats
- 1-2 hashtags max per post, only if natural
- Style: ${style}

RULES FOR LINKEDIN POSTS:
- 150-300 words each
- Professional but not robotic
- Start with a hook (not "I am pleased to...")
- End with a question or CTA to drive engagement
- Style: ${style}

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "bluesky": [
    { "type": "Insight", "text": "post text", "chars": 120 }
  ],
  "linkedin": [
    { "hook": "Opening line here", "body": "Full post body here", "cta": "Closing question or CTA" }
  ],
  "themes": ["theme1", "theme2", "theme3"]
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content.map((b) => b.text || "").join("");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude returned unexpected format.");

  const result = JSON.parse(match[0]);
  log("✅", `Generated ${result.bluesky.length} BlueSky posts and ${result.linkedin.length} LinkedIn posts`);

  return result;
};

// ─── STEP 3: SAVE REPORT TO MARKDOWN ──────────────────────────────────────

function saveReport(profileData, generated, outputDir) {
  ensureOutputDir(outputDir);

  const filename = path.join(outputDir, `posts-${today()}.md`);

  const lines = [
    `# Post Suggestions — ${today()}`,
    `**Source profile:** ${profileData.name}`,
    `**Based on:** ${profileData.posts.length} LinkedIn posts`,
    `**Key themes identified:** ${generated.themes?.join(", ") || "N/A"}`,
    "",
    "---",
    "",
    "## 🦋 BlueSky Posts",
    "",
  ];

  generated.bluesky.forEach((p, i) => {
    lines.push(`### Post ${i + 1} — ${p.type}`);
    lines.push("");
    lines.push(`> ${p.text}`);
    lines.push("");
    lines.push(`*${p.chars || p.text.length} / 300 chars*`);
    lines.push("");
  });

  lines.push("---");
  lines.push("");
  lines.push("## 💼 LinkedIn Posts");
  lines.push("");

  generated.linkedin.forEach((p, i) => {
    lines.push(`### Post ${i + 1}`);
    lines.push("");
    lines.push(`**Hook:** ${p.hook}`);
    lines.push("");
    lines.push(p.body);
    lines.push("");
    lines.push(`**CTA:** ${p.cta}`);
    lines.push("");
  });

  lines.push("---");
  lines.push(`*Generated on ${new Date().toLocaleString()} using Claude AI*`);

  fs.writeFileSync(filename, lines.join("\n"), "utf-8");
  log("💾", `Report saved to: ${filename}`);

  return filename;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀  LinkedIn → BlueSky Post Generator\n");

  const args = parseArgs();

  const profileUrl = args.profile;
  if (!profileUrl) {
    console.error('❌  Please provide a LinkedIn profile URL:\n   node index.js --profile "https://www.linkedin.com/in/someprofile"');
    process.exit(1);
  }

  const postsToFetch = args.count || CONFIG.postsToFetch;
  const style = args.style || CONFIG.postStyle;

  try {
    // Step 1: Scrape
    const profileData = await scrapeLinkedInPosts(profileUrl, postsToFetch);

    // Step 2: Generate
    const generated = await generatePosts(
      profileData,
      style,
      CONFIG.blueskySuggestions,
      CONFIG.linkedinSuggestions
    );

    // Step 3: Save
    const reportPath = saveReport(profileData, generated, CONFIG.outputDir);

    // Print a preview
    console.log("\n─────────────────────────────────────────");
    console.log("📋  BLUESKY PREVIEW\n");
    generated.bluesky.slice(0, 2).forEach((p, i) => {
      console.log(`[${i + 1}] ${p.type}: ${p.text}\n`);
    });

    console.log("─────────────────────────────────────────");
    console.log(`\n✅  Done! Full report at: ${reportPath}\n`);

  } catch (err) {
    console.error(`\n❌  Error: ${err.message}\n`);
    if (err.message.includes("APIFY")) {
      console.error("   → Check your APIFY_API_TOKEN in the .env file");
    }
    if (err.message.includes("ANTHROPIC")) {
      console.error("   → Check your ANTHROPIC_API_KEY in the .env file");
    }
    process.exit(1);
  }
}

main();
