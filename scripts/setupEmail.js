/**
 * Setup Custom SMTP & Email Templates on Supabase
 *
 * This script configures Gmail SMTP and branded email templates
 * directly via the Supabase Management API — no dashboard needed.
 *
 * Usage:
 *   1. Get your access token from https://supabase.com/dashboard/account/tokens
 *   2. Run: node scripts/setupEmail.js <access-token>
 *
 *   Or set env: SUPABASE_ACCESS_TOKEN=<token> node scripts/setupEmail.js
 */

const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

// ─── Config ─────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ACCESS_TOKEN = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

// Extract project ref from Supabase URL (e.g., "dhhdxzexphtcpsmvfxbb")
const PROJECT_REF = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split(".")[0] : null;

if (!ACCESS_TOKEN) {
  console.error("\n\x1b[31mMissing Supabase Access Token!\x1b[0m\n");
  console.error("Get your token from: https://supabase.com/dashboard/account/tokens");
  console.error("\nUsage:");
  console.error("  node scripts/setupEmail.js <access-token>");
  console.error("  SUPABASE_ACCESS_TOKEN=<token> node scripts/setupEmail.js\n");
  process.exit(1);
}

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error("\n\x1b[31mMissing Gmail credentials in .env!\x1b[0m");
  console.error("Set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.\n");
  process.exit(1);
}

if (!PROJECT_REF) {
  console.error("\n\x1b[31mMissing EXPO_PUBLIC_SUPABASE_URL in .env!\x1b[0m\n");
  process.exit(1);
}

// ─── Email Templates ────────────────────────────────────────────────

const templatesDir = path.resolve(__dirname, "..", "email-templates");

const loadTemplate = (filename) => {
  const filePath = path.join(templatesDir, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`Template not found: ${filePath}`);
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
};

const TEMPLATES = {
  confirm: {
    subject: "Welcome to Vamsify — Confirm Your Email",
    content: loadTemplate("confirm-signup.html"),
  },
  magic_link: {
    subject: "Your Vamsify Login Link",
    content: loadTemplate("magic-link.html"),
  },
  recovery: {
    subject: "Reset Your Vamsify Password",
    content: loadTemplate("reset-password.html"),
  },
  email_change: {
    subject: "Confirm Your New Email — Vamsify",
    content: loadTemplate("change-email.html"),
  },
  invite: {
    subject: "You're Invited to Vamsify!",
    content: loadTemplate("invite-user.html"),
  },
};

// ─── API Helpers ────────────────────────────────────────────────────

const API_BASE = "https://api.supabase.com/v1";

const apiCall = async (method, endpoint, body = null) => {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${typeof data === "object" ? JSON.stringify(data) : data}`);
  }
  return data;
};

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("\n\x1b[35m━━━ Vamsify Email Setup ━━━\x1b[0m\n");
  console.log(`Project: \x1b[36m${PROJECT_REF}\x1b[0m`);
  console.log(`Gmail:   \x1b[36m${GMAIL_USER}\x1b[0m\n`);

  // Step 1: Configure Custom SMTP
  console.log("\x1b[33m[1/3]\x1b[0m Configuring Gmail SMTP...");
  try {
    await apiCall("PATCH", `/projects/${PROJECT_REF}/config/auth`, {
      smtp_admin_email: GMAIL_USER,
      smtp_host: "smtp.gmail.com",
      smtp_port: "465",
      smtp_user: GMAIL_USER,
      smtp_pass: GMAIL_APP_PASSWORD,
      smtp_sender_name: "Vamsify",
      smtp_max_frequency: 60,
    });
    console.log("  \x1b[32m✓\x1b[0m SMTP configured (Gmail → smtp.gmail.com:465)");
  } catch (err) {
    console.error(`  \x1b[31m✗\x1b[0m SMTP config failed: ${err.message}`);
    console.error("  Make sure your access token has project write permissions.\n");
    process.exit(1);
  }

  // Step 2: Update Email Templates
  console.log("\x1b[33m[2/3]\x1b[0m Updating email templates...");
  const templateKeys = Object.keys(TEMPLATES);
  let success = 0;

  for (const key of templateKeys) {
    const tpl = TEMPLATES[key];
    if (!tpl.content) {
      console.log(`  \x1b[31m✗\x1b[0m ${key} — template file missing, skipped`);
      continue;
    }

    try {
      const configKey = `mailer_templates_${key}`;
      const payload = {};
      payload[`${configKey}_content`] = tpl.content;
      payload[`${configKey}_subject`] = tpl.subject;

      await apiCall("PATCH", `/projects/${PROJECT_REF}/config/auth`, payload);
      console.log(`  \x1b[32m✓\x1b[0m ${key} — "${tpl.subject}"`);
      success++;
    } catch (err) {
      console.log(`  \x1b[31m✗\x1b[0m ${key} — ${err.message}`);
    }
  }

  // Step 3: Verify
  console.log("\x1b[33m[3/3]\x1b[0m Verifying configuration...");
  try {
    const config = await apiCall("GET", `/projects/${PROJECT_REF}/config/auth`);
    const smtpOk = config.smtp_host === "smtp.gmail.com";
    console.log(`  SMTP Host: ${smtpOk ? "\x1b[32m✓" : "\x1b[31m✗"}\x1b[0m ${config.smtp_host || "not set"}`);
    console.log(`  SMTP User: ${config.smtp_user ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${config.smtp_user || "not set"}`);
    console.log(`  Sender:    ${config.smtp_sender_name || "not set"}`);
  } catch (err) {
    console.log(`  \x1b[31m✗\x1b[0m Could not verify: ${err.message}`);
  }

  // Summary
  console.log(`\n\x1b[35m━━━ Setup Complete ━━━\x1b[0m`);
  console.log(`  SMTP:      \x1b[32mGmail (${GMAIL_USER})\x1b[0m`);
  console.log(`  Templates: \x1b[32m${success}/${templateKeys.length} updated\x1b[0m`);
  console.log(`  Sender:    \x1b[32mVamsify <${GMAIL_USER}>\x1b[0m`);
  console.log(`\nAll auth emails will now come from your Gmail account!\n`);
  console.log("Test it by signing up with a new email or triggering a password reset.\n");
}

main().catch((err) => {
  console.error("\n\x1b[31mUnexpected error:\x1b[0m", err.message);
  process.exit(1);
});
