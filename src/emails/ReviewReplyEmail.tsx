import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import EmailLogo from "@/emails/EmailLogo";

/**
 * The email a customer gets when staff press "Reply" on their review in
 * /admin/reviews. Same look as the other Cuisine emails (see
 * PasswordResetEmail.tsx): logo, heading, short text, one button.
 *
 * Their own review is quoted underneath, so the customer knows exactly
 * which review this is an answer to — people review more than one dish.
 */
interface ReviewReplyEmailProps {
  firstName: string;
  itemTitle: string;
  rating: number;
  reviewComment: string | null;
  /** What the staff member typed. Line breaks are kept. */
  message: string;
  itemUrl: string;
  previewText: string;
}

const ORANGE = "#FF9540";

export default function ReviewReplyEmail({
  firstName,
  itemTitle,
  rating,
  reviewComment,
  message,
  itemUrl,
  previewText,
}: ReviewReplyEmailProps) {
  const paragraphs = message
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

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

          <Heading style={{ color: "#1f2937", fontSize: "20px", marginBottom: "4px" }}>
            Hi {firstName}, thanks for your review
          </Heading>
          <Text style={{ color: "#6b7280", fontSize: "14px", marginTop: 0 }}>
            Our team has replied to what you said about {itemTitle}.
          </Text>

          {paragraphs.map((paragraph, index) => (
            <Text
              key={index}
              style={{
                color: "#1f2937",
                fontSize: "15px",
                lineHeight: "1.6",
                whiteSpace: "pre-line",
                margin: "0 0 12px",
              }}
            >
              {paragraph}
            </Text>
          ))}

          <Text style={{ color: "#1f2937", fontSize: "15px", margin: "16px 0 0" }}>
            — The Cuisine team
          </Text>

          {/* Their review, quoted — a cream box like the admin rows. */}
          <Section
            style={{
              backgroundColor: "#F9F6F3",
              borderRadius: "12px",
              padding: "16px",
              margin: "24px 0",
            }}
          >
            <Text style={{ color: "#6b7280", fontSize: "12px", margin: "0 0 6px" }}>
              Your review of {itemTitle}
            </Text>
            <Text style={{ color: ORANGE, fontSize: "18px", letterSpacing: "2px", margin: 0 }}>
              {"★".repeat(rating)}
              <span style={{ color: "#e5e7eb" }}>{"★".repeat(5 - rating)}</span>
            </Text>
            {reviewComment && (
              <Text
                style={{
                  color: "#374151",
                  fontSize: "14px",
                  fontStyle: "italic",
                  margin: "8px 0 0",
                }}
              >
                “{reviewComment}”
              </Text>
            )}
          </Section>

          <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
            <Link
              href={itemUrl}
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
              Order {itemTitle} again →
            </Link>
          </Section>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />

          <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
            You&apos;re getting this because you reviewed a dish on Cuisine.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
