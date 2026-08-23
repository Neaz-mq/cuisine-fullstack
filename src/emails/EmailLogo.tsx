import { Img, Section } from "@react-email/components";
import { EMAIL_LOGO_URL } from "@/lib/resend";

interface EmailLogoProps {
  /**
   * গাঢ় background-এ (যেমন gift card ও broadcast email-এর সবুজ hero band)
   * wordmark সাদা হতে হবে। ডিফল্ট গাঢ়, কারণ transactional email-এর
   * container সাদা।
   */
  onDark?: boolean;
  align?: "left" | "center";
  marginBottom?: string;
}

/**
 * src/emails/EmailLogo.tsx
 *
 * প্রতিটি transactional email-এর logo lockup: dome mark (ছবি) +
 * "Cuisine" (HTML text)।
 *
 * শব্দটা ইচ্ছাকৃতভাবে ছবির অংশ নয়। Gmail, Outlook আর বেশিরভাগ mobile
 * client অচেনা প্রেরকের ছবি ডিফল্টে block করে রাখে; পুরো lockup ছবি হলে
 * সেই অবস্থায় email-এর মাথায় কেবল একটা ফাঁকা বাক্স থাকত। এভাবে নামটা
 * সব সময় দেখা যায়।
 *
 * Georgia, Frank Ruhl Libre নয়: email-এ webfont প্রায় কোনো client
 * সমর্থন করে না, তাই next/font-এ যা load করা আছে তা এখানে অর্থহীন।
 * Georgia সর্বত্র পাওয়া যায় এবং serif হিসেবে ব্র্যান্ডের কাছাকাছি।
 */
export default function EmailLogo({
  onDark = false,
  align = "left",
  marginBottom = "16px",
}: EmailLogoProps) {
  return (
    <Section style={{ marginBottom, textAlign: align }}>
      {/* alt ইচ্ছাকৃতভাবে খালি: পাশেই "Cuisine" লেখা আছে, alt দিলে
          screen reader নামটা পরপর দুবার পড়ত। */}
      <Img
        src={EMAIL_LOGO_URL}
        alt=""
        width="36"
        height="36"
        style={{ display: "inline-block", verticalAlign: "middle" }}
      />
      <span
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "26px",
          fontWeight: "bold",
          color: onDark ? "#ffffff" : "#1f2937",
          verticalAlign: "middle",
          marginLeft: "8px",
        }}
      >
        Cuisine
      </span>
    </Section>
  );
}
