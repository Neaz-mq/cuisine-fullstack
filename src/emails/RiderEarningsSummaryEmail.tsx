import { Body, Column, Container, Head, Heading, Hr, Html, Link, Preview, Row, Section, Text } from "@react-email/components";
import EmailLogo from "@/emails/EmailLogo";

/**
 * Rider "Earnings Summary" — sent at the end of each day the rider
 * delivered (Settings → Notifications → Earnings Summary). Same look as the
 * other Cuisine emails: logo, heading, a cream box, one orange button.
 */
export interface RiderEarningsSummaryEmailProps {
  firstName: string;
  dayLabel: string;
  deliveries: number;
  earned: string;
  fees: string;
  tips: string;
  cashCollected: string | null;
  balance: string;
  dashboardUrl: string;
  settingsUrl: string;
}

const ORANGE = "#FF9540";
const label = { color: "#6b7280", fontSize: "12px", margin: "0 0 4px" };
const value = { color: "#1f2937", fontSize: "18px", fontWeight: "bold" as const, margin: 0 };

export default function RiderEarningsSummaryEmail({
  firstName,
  dayLabel,
  deliveries,
  earned,
  fees,
  tips,
  cashCollected,
  balance,
  dashboardUrl,
  settingsUrl,
}: RiderEarningsSummaryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${dayLabel}: ${deliveries} ${deliveries === 1 ? "delivery" : "deliveries"}, you earned ${earned}`}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "0 auto", padding: "32px 24px", maxWidth: "560px", borderRadius: "8px" }}>
          <EmailLogo />

          <Heading style={{ color: "#1f2937", fontSize: "20px", marginBottom: "4px" }}>Your day on the road</Heading>
          <Text style={{ color: "#1f2937", fontSize: "15px", lineHeight: "1.6", marginTop: "8px" }}>
            Hi {firstName}, here&apos;s your summary for {dayLabel}. Great work!
          </Text>

          <Section style={{ backgroundColor: "#F9F6F3", borderRadius: "12px", padding: "16px", margin: "20px 0" }}>
            <Row>
              <Column>
                <Text style={label}>Deliveries</Text>
                <Text style={value}>{deliveries}</Text>
              </Column>
              <Column>
                <Text style={label}>You earned</Text>
                <Text style={value}>{earned}</Text>
              </Column>
            </Row>
            <Hr style={{ borderColor: "#e5e7eb", margin: "12px 0" }} />
            <Text style={{ color: "#1f2937", fontSize: "13px", margin: "0 0 4px" }}>Delivery fees: {fees}</Text>
            <Text style={{ color: "#1f2937", fontSize: "13px", margin: "0 0 4px" }}>Tips: {tips}</Text>
            {cashCollected && (
              <Text style={{ color: "#1f2937", fontSize: "13px", margin: "0 0 4px" }}>
                Cash collected (hand in to the restaurant): {cashCollected}
              </Text>
            )}
            <Text style={{ color: "#1f2937", fontSize: "13px", margin: 0 }}>Available to cash out: {balance}</Text>
          </Section>

          <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
            <Link
              href={dashboardUrl}
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
              See my earnings
            </Link>
          </Section>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />
          <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
            You&apos;re getting this because Earnings Summary is on in your rider settings.{" "}
            <Link href={settingsUrl} style={{ color: "#9ca3af", textDecoration: "underline" }}>
              Turn it off
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
