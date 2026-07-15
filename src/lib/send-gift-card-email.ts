import { getResendClient, EMAIL_FROM } from "@/lib/resend";
import GiftCardDeliveryEmail from "@/emails/GiftCardDeliveryEmail";

interface GiftCardForEmail {
  code: string;
  amount: number;
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
    await getResendClient().emails.send({
      from: EMAIL_FROM,
      to: giftCard.recipientEmail,
      subject: `You've received a $${giftCard.amount.toFixed(2)} Cuisine gift card!`,
      react: GiftCardDeliveryEmail({
        recipientName: giftCard.recipientName,
        purchaserName: giftCard.purchaserName,
        message: giftCard.message,
        code: giftCard.code,
        amount: giftCard.amount,
        previewText: `You've received a $${giftCard.amount.toFixed(2)} Cuisine gift card!`,
      }),
    });
  } catch (error) {
    console.error("Failed to send gift card delivery email:", error);
  }
}
