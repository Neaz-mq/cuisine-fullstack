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

interface OfferBroadcastEmailProps {
  headline: string;
  // Raw HTML written by the admin in the broadcast composer (e.g.
  // "<p>...</p>"). Rendered as-is inside the branded frame below, the same
  // way the old plain-HTML broadcast did — admins keep full control over
  // the copy without needing a rich text editor.
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  previewText: string;
}

const GREEN = "#2C6252";
const ORANGE = "#FF4C15";
const LOGO_URL =
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752050762/Group_22_fhiuuw.png";

export default function OfferBroadcastEmail({
  headline,
  bodyHtml,
  ctaText,
  ctaUrl,
  previewText,
}: OfferBroadcastEmailProps) {
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
          {/* Hero band — sets this apart from transactional emails at a glance */}
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
              Special Offer
            </Text>
            <Heading
              style={{
                color: "#ffffff",
                fontSize: "24px",
                lineHeight: "1.3",
                margin: "0",
              }}
            >
              {headline}
            </Heading>
          </Section>

          {/* Body — admin-authored HTML rendered inside consistent typography */}
          <Section style={{ padding: "28px 24px 8px 24px" }}>
            <div
              style={{ color: "#374151", fontSize: "15px", lineHeight: "1.6" }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </Section>

          {/* CTA button */}
          <Section style={{ textAlign: "center", margin: "16px 0 8px 0" }}>
            <Link
              href={ctaUrl}
              style={{
                backgroundColor: ORANGE,
                color: "#ffffff",
                padding: "14px 32px",
                borderRadius: "6px",
                fontSize: "15px",
                fontWeight: "bold",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {ctaText} →
            </Link>
          </Section>

          <Hr style={{ borderColor: "#e5e7eb", margin: "28px 24px 16px 24px" }} />

          {/* Footer — brand sign-off. Resend injects the required unsubscribe
              link/header automatically for broadcast sends (RFC 8058), so no
              manual unsubscribe link is added here. */}
          <Section style={{ padding: "0 24px" }}>
            <Text style={{ fontSize: "12px", color: "#9ca3af", margin: "0 0 4px 0" }}>
              You&apos;re receiving this email because you opted in to offers and
              updates from Cuisine.
            </Text>
            <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
              &copy; {new Date().getFullYear()} Cuisine. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}