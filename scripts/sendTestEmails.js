/**
 * Send Dummy Payment Notification Emails for Testing Gmail Import
 *
 * Usage:
 *   node scripts/sendTestEmails.js your-email@gmail.com
 *
 * Setup:
 *   1. Go to https://myaccount.google.com/apppasswords
 *   2. Generate an App Password for "Mail"
 *   3. Set environment variables:
 *        GMAIL_USER=your-email@gmail.com
 *        GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
 *   4. Run: node scripts/sendTestEmails.js your-email@gmail.com
 *
 * This sends 15 realistic payment notification emails from various
 * Indian and international services to test the Gmail import feature.
 */

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Load .env file
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const TARGET_EMAIL = process.argv[2] || GMAIL_USER;

if (!TARGET_EMAIL) {
  console.error("Usage: node scripts/sendTestEmails.js <target-email>");
  console.error("Example: node scripts/sendTestEmails.js vamsi@gmail.com");
  process.exit(1);
}

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error("\nMissing environment variables!");
  console.error("Set GMAIL_USER and GMAIL_APP_PASSWORD before running.\n");
  console.error("Steps to get App Password:");
  console.error("1. Go to https://myaccount.google.com/apppasswords");
  console.error("2. Select 'Mail' and generate a password");
  console.error("3. Run:");
  console.error(`   GMAIL_USER=you@gmail.com GMAIL_APP_PASSWORD=xxxx node scripts/sendTestEmails.js ${TARGET_EMAIL}\n`);
  process.exit(1);
}

// ─── Test Email Templates ───────────────────────────────────────────

const today = new Date();
const daysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d;
};

const TEST_EMAILS = [
  // ── EXPENSES (Debits) ──
  {
    subject: "Payment of Rs. 325.70 to Zomato APL was successful",
    body: `Dear Customer,\n\nYour payment of Rs. 325.70 to Zomato APL has been debited from your account.\n\nTransaction ID: ZMT${Date.now()}\nDate: ${daysAgo(1).toLocaleDateString("en-IN")}\nMerchant: Zomato\nAmount: Rs. 325.70\n\nIf you did not authorize this transaction, please contact us immediately.\n\nRegards,\nHDFC Bank`,
    date: daysAgo(1),
  },
  {
    subject: "Transaction Alert: Rs 1,249 debited - Amazon Pay",
    body: `Hi,\n\nRs 1,249.00 has been debited from your account for your Amazon purchase.\n\nOrder ID: 402-${Math.floor(Math.random() * 9000000 + 1000000)}\nPayment Method: UPI\nMerchant: Amazon Pay\n\nThank you for shopping with Amazon!`,
    date: daysAgo(2),
  },
  {
    subject: "Uber Trip Receipt - Payment of Rs. 187 debited",
    body: `Your Uber trip has ended.\n\nTrip fare: Rs. 187.00\nPayment: Debited from linked account\nPickup: Madhapur\nDrop: HITEC City\nDistance: 4.2 km\nDuration: 18 mins\n\nThank you for riding with Uber!`,
    date: daysAgo(3),
  },
  {
    subject: "Swiggy Order Confirmed - Rs 456 payment successful",
    body: `Your Swiggy order has been placed!\n\nAmount Paid: Rs 456.00\nRestaurant: Paradise Biryani\nDelivery: 30-35 mins\nPayment: Debited via UPI\n\nTrack your order on the Swiggy app.`,
    date: daysAgo(3),
  },
  {
    subject: "Netflix Subscription - Rs 649 debited from your account",
    body: `Dear Subscriber,\n\nYour Netflix monthly subscription of Rs 649.00 has been charged.\n\nPlan: Standard\nBilling Period: ${daysAgo(5).toLocaleDateString("en-IN")} to ${daysAgo(-25).toLocaleDateString("en-IN")}\nPayment Method: Credit Card ending 4521\n\nEnjoy streaming!`,
    date: daysAgo(5),
  },
  {
    subject: "Airtel Broadband Bill Payment - Rs 999 debited",
    body: `Payment Confirmation\n\nYour Airtel broadband bill of Rs 999 has been paid successfully.\n\nAccount: AIRT${Math.floor(Math.random() * 900000 + 100000)}\nPlan: 100 Mbps Unlimited\nBilling Month: March 2026\n\nThank you for being an Airtel customer.`,
    date: daysAgo(6),
  },
  {
    subject: "Zepto Quick Delivery - Rs 28 payment debited",
    body: `Order Delivered!\n\nYour Zepto order of Rs 28.00 has been delivered.\n\nItems: Milk 500ml x 1\nDelivery Time: 8 minutes\nPayment: Rs 28 debited via UPI\n\nRate your experience on the app.`,
    date: daysAgo(7),
  },
  {
    subject: "Flipkart Purchase - Rs 3,499 debited for Electronics",
    body: `Thank you for your purchase on Flipkart!\n\nProduct: boAt Airdopes 141\nAmount: Rs 3,499.00\nPayment: Debited from account\nOrder ID: OD${Math.floor(Math.random() * 90000000 + 10000000)}\nDelivery: Expected by ${daysAgo(-3).toLocaleDateString("en-IN")}\n\nTrack your order on Flipkart.`,
    date: daysAgo(4),
  },
  {
    subject: "Apollo Pharmacy - Rs 850 payment debited",
    body: `Apollo Pharmacy - Payment Receipt\n\nAmount Paid: Rs 850.00\nStore: Apollo Pharmacy, Gachibowli\nPayment: Debited via card\nItems: Prescription medicines\n\nThank you for choosing Apollo Pharmacy.\nStay healthy!`,
    date: daysAgo(8),
  },
  {
    subject: "BESCOM Electricity Bill - Rs 2,340 debited",
    body: `Electricity Bill Payment Successful\n\nAmount: Rs 2,340.00\nConsumer No: 123456789\nBilling Period: Feb 2026\nUnits Consumed: 245\n\nPayment has been debited from your bank account.\n\nBESCOM - Bangalore Electricity Supply`,
    date: daysAgo(10),
  },

  // ── INCOMES (Credits) ──
  {
    subject: "Salary Credit - Rs 45,000 credited to your account",
    body: `Dear Customer,\n\nRs 45,000.00 has been credited to your account.\n\nDescription: Salary for March 2026\nFrom: TechCorp Solutions Pvt Ltd\nReference: SAL${Date.now()}\n\nHDFC Bank`,
    date: daysAgo(2),
  },
  {
    subject: "Refund of Rs 1,249 credited - Amazon Order Cancelled",
    body: `Refund Processed\n\nRs 1,249.00 has been credited to your account as a refund.\n\nOrder: 402-${Math.floor(Math.random() * 9000000 + 1000000)}\nReason: Order cancelled by customer\nRefund Method: Original payment method\n\nThe amount will reflect in 3-5 business days.`,
    date: daysAgo(1),
  },
  {
    subject: "UPI Payment Received - Rs 2,500 credited to your account",
    body: `You have received Rs 2,500.00 via UPI.\n\nFrom: Rahul Sharma\nUPI Ref: ${Math.floor(Math.random() * 900000000 + 100000000)}\nRemarks: Freelance payment\n\nAmount credited to your account.`,
    date: daysAgo(4),
  },
  {
    subject: "Cashback of Rs 50 credited - Paytm Wallet",
    body: `Congratulations!\n\nRs 50.00 cashback has been credited to your Paytm wallet.\n\nOffer: 10% cashback on first Swiggy order\nMax Cashback: Rs 50\n\nKeep shopping and earning!`,
    date: daysAgo(5),
  },
  {
    subject: "Groww - Dividend of Rs 1,200 credited to your account",
    body: `Investment Update\n\nDividend of Rs 1,200.00 has been credited to your bank account.\n\nFund: HDFC Mid-Cap Opportunities Fund\nDividend Type: Payout\nRecord Date: ${daysAgo(7).toLocaleDateString("en-IN")}\n\nHappy Investing!\nGroww`,
    date: daysAgo(6),
  },
];

// ─── Send Emails ────────────────────────────────────────────────────

async function main() {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  // Verify connection
  try {
    await transporter.verify();
    console.log("\nSMTP connection verified successfully!\n");
  } catch (err) {
    console.error("SMTP connection failed:", err.message);
    console.error("\nMake sure:");
    console.error("- GMAIL_USER is correct");
    console.error("- GMAIL_APP_PASSWORD is a valid App Password (not your regular password)");
    console.error("- 2-Step Verification is enabled on your Google account\n");
    process.exit(1);
  }

  console.log(`Sending ${TEST_EMAILS.length} test emails to ${TARGET_EMAIL}...\n`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < TEST_EMAILS.length; i++) {
    const email = TEST_EMAILS[i];
    const isCredit = email.subject.toLowerCase().includes("credit") ||
                     email.subject.toLowerCase().includes("received") ||
                     email.subject.toLowerCase().includes("salary") ||
                     email.subject.toLowerCase().includes("refund") ||
                     email.subject.toLowerCase().includes("cashback") ||
                     email.subject.toLowerCase().includes("dividend");

    try {
      await transporter.sendMail({
        from: `"Payment Notifications" <${GMAIL_USER}>`,
        to: TARGET_EMAIL,
        subject: email.subject,
        text: email.body,
        date: email.date,
        headers: {
          "X-Test-Email": "vamsify-payment-test",
        },
      });

      const type = isCredit ? "\x1b[32mINCOME\x1b[0m" : "\x1b[31mEXPENSE\x1b[0m";
      console.log(`  [${type}] ${email.subject.substring(0, 65)}...`);
      sent++;

      // Small delay to avoid rate limiting
      if (i < TEST_EMAILS.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.error(`  [FAILED] ${email.subject.substring(0, 50)}... - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`Done! Sent: ${sent}, Failed: ${failed}`);
  console.log(`\nNow open Vamsify and go to Import tab to test Gmail import.`);
  console.log(`The emails should appear in your inbox within a few seconds.\n`);
}

main().catch(console.error);
