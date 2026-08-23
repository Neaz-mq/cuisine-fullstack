import { getResendClient, EMAIL_FROM } from "@/lib/resend";
import PasswordResetEmail from "@/emails/PasswordResetEmail";
import { RESET_TOKEN_TTL_MS } from "@/lib/password-reset";

interface PasswordResetEmailParams {
  to: string;
  firstName: string;
  resetUrl: string;
}

/**
 * src/lib/send-password-reset-email.ts
 *
 * gift card email-এর মতোই কখনো throw করে না, কিন্তু কারণটা এখানে আলাদা
 * এবং আরও কঠোর।
 *
 * ওখানে swallow করার কারণ ছিল: gift card ইতিমধ্যেই DB-তে আছে, email
 * ব্যর্থ হলে payment flow ভাঙা উচিত নয়।
 *
 * এখানে কারণ: throw করলে API route-টা 500 ফেরত দিত, আর সেই 500 কেবল
 * তখনই আসত যখন email ঠিকানাটা আসলে বিদ্যমান কোনো account-এর। অর্থাৎ
 * error response-টাই হয়ে যেত user enumeration oracle — attacker
 * ঠিকানার তালিকা চালিয়ে দেখে নিত কোনগুলো নিবন্ধিত। forgot-password
 * endpoint যে সবসময় একই উত্তর দেয়, সেই পুরো ব্যবস্থাটাই এখানে একটা
 * uncaught throw দিয়ে নষ্ট হয়ে যেত।
 *
 * তাই ব্যর্থতা কেবল server log-এ যায়, response-এ কখনো নয়।
 */
export async function sendPasswordResetEmail({
  to,
  firstName,
  resetUrl,
}: PasswordResetEmailParams): Promise<void> {
  const expiresInMinutes = Math.round(RESET_TOKEN_TTL_MS / 60_000);
  const subject = "Reset your Cuisine password";

  try {
    await getResendClient().emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      react: PasswordResetEmail({
        firstName,
        resetUrl,
        expiresInMinutes,
        previewText: subject,
      }),
    });
  } catch (error) {
    // ⚠️ resetUrl কখনো log করা যাবে না — ওতে plaintext token আছে, আর
    // log সাধারণত DB-র চেয়ে বেশি জায়গায় ছড়ায় (Sentry, CI, ফাইল)।
    // token ফাঁস হওয়া মানে account হাতছাড়া।
    console.error("Failed to send password reset email:", error);
  }
}
