import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PasswordResetEmailProps {
  firstName: string;
  resetUrl: string;
  /** কত মিনিট পরে link অকেজো হবে — template নিজে হিসাব করে না। */
  expiresInMinutes: number;
  previewText: string;
}

const GREEN = "#2C6252";
const ORANGE = "#FF4C15";
const LOGO_URL =
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752050762/Group_22_fhiuuw.png";

export default function PasswordResetEmail({
  firstName,
  resetUrl,
  expiresInMinutes,
  previewText,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "Arial, sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "0 auto",
            padding: "32px 24px",
            maxWidth: "560px",
            borderRadius: "8px",
          }}
        >
          <Img src={LOGO_URL} alt="Cuisine" width="120" style={{ marginBottom: "16px" }} />

          <Heading style={{ color: "#1f2937", fontSize: "20px", marginBottom: "4px" }}>
            Reset your password, {firstName}
          </Heading>
          <Text style={{ color: "#6b7280", fontSize: "14px", marginTop: 0 }}>
            Use the button below to choose a new password. The link works once and
            expires in {expiresInMinutes} minutes.
          </Text>

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Link
              href={resetUrl}
              style={{
                backgroundColor: ORANGE,
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "bold",
                textDecoration: "none",
              }}
            >
              Choose a new password →
            </Link>
          </Section>

          {/* কিছু email client button-এর href চেপে দেয় বা image/CSS ছাড়া
              render করে। সেই অবস্থায় URL-টা নিজেই দৃশ্যমান না থাকলে
              ব্যবহারকারীর হাতে আর কোনো উপায় থাকে না — তাই plain text
              হিসেবেও রাখা হয়েছে। */}
          <Text style={{ color: "#9ca3af", fontSize: "12px", margin: "0 0 4px" }}>
            Button not working? Paste this into your browser:
          </Text>
          <Text
            style={{
              color: GREEN,
              fontSize: "12px",
              margin: 0,
              wordBreak: "break-all",
            }}
          >
            {resetUrl}
          </Text>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />

          {/* এই লাইনটা নিরাপত্তার অংশ, ভদ্রতার নয়: কেউ অন্যের email দিয়ে
              reset চাইলে আসল মালিক এখান থেকেই বুঝবেন কিছু একটা ঘটছে।
              সেই সঙ্গে এটাও স্পষ্ট করা হচ্ছে যে নিষ্ক্রিয় থাকলেই যথেষ্ট —
              আতঙ্কিত হয়ে অচেনা link-এ click করার দরকার নেই। */}
          <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
            Didn&apos;t ask for this? You can ignore this email — your password stays
            as it is, and the link above expires on its own.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
