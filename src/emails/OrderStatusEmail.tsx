import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import EmailLogo from "@/emails/EmailLogo";

/**
 * "Your order is on its way / delivered / cancelled" — the "Order Updates"
 * switch on Profile Details (lib/send-order-status-email.ts).
 *
 * Same look as the other Cuisine emails (see ReviewReplyEmail.tsx): logo,
 * heading, short text, a cream box, one orange button.
 */
export interface OrderStatusEmailProps {
  firstName: string;
  orderCode: string;
  heading: string;
  message: string;
  itemsLabel: string;
  totalLabel: string;
  buttonLabel: string;
  buttonUrl: string;
  previewText: string;
  settingsUrl: string | null;
}

const ORANGE = "#FF9540";

export default function OrderStatusEmail({
  firstName,
  orderCode,
  heading,
  message,
  itemsLabel,
  totalLabel,
  buttonLabel,
  buttonUrl,
  previewText,
  settingsUrl,
}: OrderStatusEmailProps) {
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
          <EmailLogo />

          <Heading style={{ color: "#1f2937", fontSize: "20px", marginBottom: "4px" }}>{heading}</Heading>
          <Text style={{ color: "#1f2937", fontSize: "15px", lineHeight: "1.6", marginTop: "8px" }}>
            Hi {firstName}, {message}
          </Text>

          <Section style={{ backgroundColor: "#F9F6F3", borderRadius: "12px", padding: "16px", margin: "20px 0" }}>
            <Text style={{ color: "#6b7280", fontSize: "12px", margin: "0 0 4px" }}>Order {orderCode}</Text>
            <Text style={{ color: "#1f2937", fontSize: "14px", margin: "0 0 8px" }}>{itemsLabel}</Text>
            <Text style={{ color: "#1f2937", fontSize: "16px", fontWeight: "bold", margin: 0 }}>{totalLabel}</Text>
          </Section>

          <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
            <Link
              href={buttonUrl}
              style={{
                backgroundColor: ORANGE,
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "999px",
                fontSize: "14px",
                fontWeight: "bold",
                textDecoration: "none",
              }}
            >
              {buttonLabel}
            </Link>
          </Section>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />

          <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
            You&apos;re getting this because you ordered from Cuisine.
            {settingsUrl && (
              <>
                {" "}
                Don&apos;t want order updates?{" "}
                <Link href={settingsUrl} style={{ color: "#9ca3af", textDecoration: "underline" }}>
                  Turn them off
                </Link>
                .
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
