# Supabase Custom SMTP + Email Templates Setup

## Step 1: Configure Custom SMTP (Gmail)

Go to **Supabase Dashboard** → **Project Settings** → **Authentication** → **SMTP Settings**

Toggle **Enable Custom SMTP** and enter:

| Field | Value |
|-------|-------|
| Sender email | `gopisettyvamsi.159@gmail.com` |
| Sender name | `Vamsify` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Minimum interval | `60` (seconds) |
| Username | `gopisettyvamsi.159@gmail.com` |
| Password | `uhvt ywko nlpr tzfs` |

Click **Save**.

## Step 2: Update Email Templates

Go to **Supabase Dashboard** → **Authentication** → **Email Templates**

For each template type, paste the corresponding HTML file content:

| Template | File |
|----------|------|
| Confirm signup | `confirm-signup.html` |
| Magic Link | `magic-link.html` |
| Change Email Address | `change-email.html` |
| Reset Password | `reset-password.html` |
| Invite user | `invite-user.html` |

### For each template:
1. Click the template tab (e.g., "Confirm signup")
2. Update the **Subject** field:
   - Confirm signup: `Welcome to Vamsify — Confirm Your Email`
   - Magic Link: `Your Vamsify Login Link`
   - Change Email: `Confirm Your New Email — Vamsify`
   - Reset Password: `Reset Your Vamsify Password`
   - Invite user: `You're Invited to Vamsify!`
3. Paste the HTML from the corresponding file into the **Body** editor (use HTML/Source mode)
4. Click **Save**

## Step 3: Test

1. Sign out of Vamsify
2. Sign up with a new email — you should receive the branded confirmation email
3. Check that the email comes from `gopisettyvamsi.159@gmail.com` (Vamsify)
