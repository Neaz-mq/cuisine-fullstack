import { getResendClient, EMAIL_FROM } from "@/lib/resend";
import GiftCardDeliveryEmail from "@/emails/GiftCardDeliveryEmail";
import { type MoneyInput, toMoney } from "@/lib/money";

interface GiftCardForEmail {
  code: string;
  /** Decimal বা number — caller Prisma থেকে সরাসরি initialAmount পাঠায়। */
  amount: MoneyInput;
  recipientEmail: string;
  recipientName: string;
  purchaserName?: string | null;
  message?: string | null;
}

// Called right after a gift card is created (purchase webhook or admin
// manual issue). Never throws — a failed email should never take down
// the payment/issue flow, since the gift card itself already exists in
// the database by the time this runs. Errors are logged so they're
// visible in server logs without surfacing to the customer/admin.
export async function sendGiftCardEmail(giftCard: GiftCardForEmail) {
  try {
    // React email template এখনো number নেয় — display-only, তাই এখানে
    // একবার রূপান্তর করে নিচে সেটাই ব্যবহার করা হয়।
    //
    // ⚠️ "$" এখনো hardcoded, দুই জায়গায়। Stage 3-এ formatMoney() আর
    // settings-এর currency দিয়ে বদলাবে — তার আগে ইউরোপ/জাপানের
    // গ্রাহক ভুল মুদ্রা চিহ্ন দেখবেন।
    const amount = toMoney(giftCard.amount).toNumber();

    await getResendClient().emails.send({
      from: EMAIL_FROM,
      to: giftCard.recipientEmail,
      subject: `You've received a $${amount.toFixed(2)} Cuisine gift card!`,
      react: GiftCardDeliveryEmail({
        recipientName: giftCard.recipientName,
        purchaserName: giftCard.purchaserName,
        message: giftCard.message,
        code: giftCard.code,
        amount,
        previewText: `You've received a $${amount.toFixed(2)} Cuisine gift card!`,
      }),
    });
  } catch (error) {
    console.error("Failed to send gift card delivery email:", error);
  }
}
