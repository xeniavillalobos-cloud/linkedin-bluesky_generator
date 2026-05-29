# LinkedIn → BlueSky Post Generator

Automatically scrapes your boss's LinkedIn posts and generates BlueSky + LinkedIn content suggestions using Claude AI.

---

## ⚡ Quick Start (GitHub Codespaces — no install needed)

### Step 1 — Open in Codespaces

1. Go to [github.com](https://github.com) and sign in (or create a free account)
2. Create a new repository: click **"+"** → **"New repository"** → name it `linkedin-bluesky-generator`
3. Upload all these project files to the repo
4. Click the green **"Code"** button → **"Codespaces"** tab → **"Create codespace on main"**
5. Wait ~30 seconds. You now have a full VS Code environment in your browser.

---

### Step 2 — Install dependencies

In the Codespaces terminal (bottom panel), run:

```bash
npm install
```

---

### Step 3 — Add your API keys

Copy the example env file:

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:

```
ANTHROPIC_API_KEY=sk-ant-...        ← from console.anthropic.com
APIFY_API_TOKEN=apify_api_...       ← from console.apify.com
```

**Getting your keys:**
- **Anthropic API key:** Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key
- **Apify token:** Go to [console.apify.com](https://console.apify.com) → Settings → Integrations → API token

> ⚠️ Never commit your `.env` file to GitHub. It is already in `.gitignore`.

---

### Step 4 — Run it

```bash
node index.js --profile "https://www.linkedin.com/in/yourbosspublicprofile"
```

Optional flags:
```bash
--count 15          # number of LinkedIn posts to fetch (default: 10)
--style "casual"    # post style: "thought leadership" | "casual" | "hot takes" | "educational"
```

Example:
```bash
node index.js --profile "https://www.linkedin.com/in/johndoe" --count 10 --style "thought leadership"
```

Results are saved to the `reports/` folder as a Markdown file.

---

## 🔁 Automate with GitHub Actions (run weekly, no computer needed)

### Step 1 — Add secrets to your GitHub repo

In your repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add:
- `ANTHROPIC_API_KEY` — your Anthropic key
- `APIFY_API_TOKEN` — your Apify token

### Step 2 — Set your default profile URL

In **Settings** → **Secrets and variables** → **Actions** → **Variables** tab:

Add a variable:
- Name: `DEFAULT_PROFILE_URL`
- Value: `https://www.linkedin.com/in/yourbosspublicprofile`

### Step 3 — Enable Actions

Go to the **Actions** tab in your repo and enable workflows if prompted.

That's it. Every Monday at 8am UTC, the script runs automatically. Reports are saved as downloadable artifacts in the Actions tab.

You can also trigger it manually anytime: **Actions** → **Weekly Post Generator** → **Run workflow**.

---

## 📁 Output example

Reports are saved to `reports/posts-YYYY-MM-DD.md` and look like this:

```
# Post Suggestions — 2026-05-29
Source profile: Jane Smith
Based on: 10 LinkedIn posts
Key themes: AI in education, leadership, research

## 🦋 BlueSky Posts

### Post 1 — Insight
> Most universities still teach research methods from the 90s.
> AI didn't just change the tools — it changed what questions
> are even worth asking. #AcademicAI

147 / 300 chars

...

## 💼 LinkedIn Posts

### Post 1
Hook: The biggest barrier to AI adoption in universities isn't the technology.
...
```

---

## 💡 Tips

- LinkedIn profiles must be **public** for Apify to scrape them
- Apify's free tier gives ~$5 of compute monthly — enough for ~20 scrape runs
- The Anthropic API costs roughly $0.01–0.03 per run
- Run costs are very low — this workflow costs pennies per week

---

## 🛠 Customise

Edit the `CONFIG` block at the top of `index.js` to change defaults:

```js
const CONFIG = {
  postsToFetch: 10,           // how many LinkedIn posts to analyse
  blueskySuggestions: 5,      // how many BlueSky posts to generate
  linkedinSuggestions: 3,     // how many LinkedIn posts to generate
  postStyle: "thought leadership",
  outputDir: "./reports",
};
```
