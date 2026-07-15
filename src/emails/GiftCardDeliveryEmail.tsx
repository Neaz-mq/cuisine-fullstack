import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface GiftCardDeliveryEmailProps {
  recipientName: string;
  purchaserName?: string | null;
  message?: string | null;
  code: string;
  amount: number;
  previewText: string;
}

const GREEN = "#2C6252";
const ORANGE = "#FF4C15";
const LOGO_URL =
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752050762/Group_22_fhiuuw.png";

export default function GiftCardDeliveryEmail({
  recipientName,
  purchaserName,
  message,
  code,
  amount,
  previewText,
}: GiftCardDeliveryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "Arial, sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "0 auto",
            padding: "0 0 32px 0",
            maxWidth: "560px",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {/* Hero band — same treatment as OfferBroadcastEmail, so gift
              card mail is instantly recognizable as coming from Cuisine */}
          <Section style={{ backgroundColor: GREEN, padding: "28px 24px", textAlign: "center" }}>
            <Img
              src={LOGO_URL}
              alt="Cuisine"
              width="110"
              style={{ margin: "0 auto 16px auto" }}
            />
            <Text
              style={{
                display: "inline-block",
                backgroundColor: ORANGE,
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "bold",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "6px 14px",
                borderRadius: "999px",
                margin: "0 0 12px 0",
              }}
            >
              Gift Card
            </Text>
            <Heading
              style={{
                color: "#ffffff",
                fontSize: "24px",
                lineHeight: "1.3",
                margin: "0",
              }}
            >
              You&apos;ve received a Cuisine gift card!
            </Heading>
          </Section>

          <Section style={{ padding: "28px 24px 8px 24px" }}>
            <Text style={{ color: "#374151", fontSize: "15px", lineHeight: "1.6", margin: "0 0 16px 0" }}>
              Hi {recipientName},
            </Text>
            <Text style={{ color: "#374151", fontSize: "15px", lineHeight: "1.6", margin: "0 0 16px 0" }}>
              {purchaserName
                ? `${purchaserName} sent you a gift card to enjoy at Cuisine.`
                : "You've been sent a gift card to enjoy at Cuisine."}
            </Text>

            {message && (
              <Section
                style={{
                  backgroundColor: "#f3f4f6",
                  borderRadius: "6px",
                  padding: "16px",
                  margin: "0 0 20px 0",
                }}
              >
                <Text style={{ color: "#374151", fontSize: "14px", fontStyle: "italic", margin: 0 }}>
                  &quot;{message}&quot;
                </Text>
              </Section>
            )}

            {/* The card itself — a simple styled block with the amount and code */}
            <Section
              style={{
                border: `2px dashed ${GREEN}`,
                borderRadius: "8px",
                padding: "24px",
                textAlign: "center",
                margin: "0 0 20px 0",
              }}
            >
              <Text style={{ color: "#6b7280", fontSize: "12px", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 8px 0" }}>
                Gift Card Value
              </Text>
              <Text style={{ color: GREEN, fontSize: "32px", fontWeight: "bold", margin: "0 0 16px 0" }}>
                ${amount.toFixed(2)}
              </Text>
              <Text style={{ color: "#6b7280", fontSize: "12px", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 4px 0" }}>
                Gift Card Code
              </Text>
              <Text
                style={{
                  color: "#111827",
                  fontSize: "20px",
                  fontWeight: "bold",
                  letterSpacing: "0.05em",
                  fontFamily: "monospace",
                  margin: 0,
                }}
              >
                {code}
              </Text>
            </Section>

            <Text style={{ color: "#6b7280", fontSize: "13px", lineHeight: "1.6", margin: "0 0 8px 0" }}>
              Enter this code at checkout on Cuisine to redeem it — in full or
              across multiple orders until the balance runs out.
            </Text>
          </Section>

          <Hr style={{ borderColor: "#e5e7eb", margin: "28px 24px 16px 24px" }} />

          <Section style={{ padding: "0 24px" }}>
            <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
              &copy; {new Date().getFullYear()} Cuisine. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
