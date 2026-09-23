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

/**
 * The offer email sent to marketing subscribers from /admin/marketing
 * ("Email Subscribers" on the Offers page).
 *
 * Same colours as the admin and the site: the orange → pink gradient
 * (#FF9540 → #FF70C6), cream cards (#F9F6F3), black text, serif headings.
 * Email clients don't load web fonts reliably, so headings fall back to
 * Georgia — the nearest safe serif to Frank Ruhl Libre.
 *
 * ⚠️ Gradients: Outlook ignores `background-image`, so every gradient
 * sits on a solid orange `backgroundColor` — it just shows flat orange
 * there instead of a white box.
 *
 * `featured` is optional: when staff pick one of the running product
 * offers, its dish is shown as a card (photo, old and new price). The
 * prices come from the server (see the broadcast route), never from the
 * browser.
 */
export type FeaturedOfferEmail = {
  title: string;
  imageUrl: string | null;
  badge: string;
  oldPrice: string;
  newPrice: string;
  /** "Ends Aug 6, 2026" / "No end date" — plus "· Members only" if so. */
  note: string;
};

interface OfferBroadcastEmailProps {
  headline: string;
  /** Safe HTML made from the admin's plain text (plainTextToHtml). */
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  previewText: string;
  featured?: FeaturedOfferEmail | null;
  /**
   * Where "Unsubscribe" points. For a broadcast this is Resend's
   * placeholder "{{{RESEND_UNSUBSCRIBE_URL}}}", which Resend swaps for each
   * contact's own link when it sends — without it the email has no visible
   * unsubscribe link at all (Resend does not add one by itself). A test
   * email has no contact, so it passes null and shows a note instead.
   */
  unsubscribeUrl?: string | null;
}

const ORANGE = "#FF9540";
const GRADIENT = "linear-gradient(93.36deg, #FF9540 0%, #FF70C6 145.78%)";
const CREAM = "#F9F6F3";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

export default function OfferBroadcastEmail({
  headline,
  bodyHtml,
  ctaText,
  ctaUrl,
  previewText,
  featured = null,
  unsubscribeUrl = null,
}: OfferBroadcastEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: SANS, margin: 0, padding: "24px 12px" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "0 auto",
            maxWidth: "560px",
            borderRadius: "20px",
            overflow: "hidden",
          }}
        >
          {/* Hero band — the brand gradient */}
          <Section
            style={{
              backgroundColor: ORANGE,
              backgroundImage: GRADIENT,
              padding: "32px 28px",
              textAlign: "center",
            }}
          >
            {/* Wordmark only, centred. The logo mark is orange, so on
                this orange gradient it disappeared. */}
            <Text
              style={{
                fontFamily: SERIF,
                fontSize: "26px",
                fontWeight: "bold",
                color: "#ffffff",
                textAlign: "center",
                margin: "0 0 16px 0",
              }}
            >
              Cuisine
            </Text>
            <Text
              style={{
                display: "inline-block",
                backgroundColor: "#ffffff",
                color: "#000000",
                fontSize: "12px",
                fontWeight: "bold",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "8px 14px",
                borderRadius: "999px",
                margin: "0 0 14px 0",
              }}
            >
              {featured ? `${featured.badge} · Special Offer` : "Special Offer"}
            </Text>
            <Heading
              style={{
                color: "#ffffff",
                fontFamily: SERIF,
                fontSize: "28px",
                fontWeight: 600,
                lineHeight: "1.2",
                margin: 0,
              }}
            >
              {headline}
            </Heading>
          </Section>

          {/* Message */}
          <Section style={{ padding: "28px 28px 4px 28px" }}>
            <div
              style={{ color: "rgba(0,0,0,0.7)", fontSize: "15px", lineHeight: "1.7" }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </Section>

          {/* The dish on offer, when one was picked */}
          {featured && (
            <Section style={{ padding: "12px 28px 0 28px" }}>
              <Section
                style={{ backgroundColor: CREAM, borderRadius: "16px", padding: "12px" }}
              >
                {featured.imageUrl && (
                  <Img
                    src={featured.imageUrl}
                    alt={featured.title}
                    width="100%"
                    style={{
                      width: "100%",
                      maxWidth: "480px",
                      height: "auto",
                      borderRadius: "12px",
                      display: "block",
                    }}
                  />
                )}
                <Text
                  style={{
                    fontFamily: SERIF,
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "#000000",
                    margin: "14px 4px 6px 4px",
                  }}
                >
                  {featured.title}
                </Text>
                <Text style={{ margin: "0 4px 6px 4px", fontSize: "14px" }}>
                  <span style={{ color: "rgba(0,0,0,0.45)", textDecoration: "line-through" }}>
                    {featured.oldPrice}
                  </span>
                  <span
                    style={{
                      fontFamily: SERIF,
                      fontSize: "22px",
                      fontWeight: 700,
                      color: "#000000",
                      marginLeft: "10px",
                    }}
                  >
                    {featured.newPrice}
                  </span>
                </Text>
                <Text style={{ margin: "0 4px 4px 4px", fontSize: "12px", color: "rgba(0,0,0,0.7)" }}>
                  {featured.note}
                </Text>
              </Section>
            </Section>
          )}

          {/* Call to action — gradient pill, like the site's buttons */}
          <Section style={{ textAlign: "center", padding: "28px 28px 8px 28px" }}>
            <Link
              href={ctaUrl}
              style={{
                backgroundColor: ORANGE,
                backgroundImage: GRADIENT,
                color: "#ffffff",
                padding: "15px 36px",
                borderRadius: "999px",
                fontSize: "16px",
                fontWeight: "bold",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {ctaText}
            </Link>
          </Section>

          {/* Padding on a wrapper, not margin on the Hr — Hr is 100% wide,
              so side margins pushed it past the card's right edge. */}
          <Section style={{ padding: "28px 28px 0 28px" }}>
            <Hr style={{ borderColor: "#EFE9E3", margin: "0 0 16px 0" }} />
          </Section>

          {/* Footer — with the unsubscribe link every marketing email must
              carry (see `unsubscribeUrl` above). */}
          <Section style={{ padding: "0 28px 28px 28px" }}>
            <Text style={{ fontSize: "12px", color: "rgba(0,0,0,0.5)", margin: "0 0 4px 0" }}>
              You&apos;re receiving this email because you opted in to offers and updates from
              Cuisine.{" "}
              {unsubscribeUrl ? (
                <Link
                  href={unsubscribeUrl}
                  style={{ color: "rgba(0,0,0,0.7)", textDecoration: "underline" }}
                >
                  Unsubscribe
                </Link>
              ) : (
                <span>(Test email — the real one has an Unsubscribe link here.)</span>
              )}
            </Text>
            <Text style={{ fontSize: "12px", color: "rgba(0,0,0,0.5)", margin: 0 }}>
              &copy; {new Date().getFullYear()} Cuisine. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
