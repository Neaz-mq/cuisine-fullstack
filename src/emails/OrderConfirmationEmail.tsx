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
  Row,
  Column,
  Section,
  Text,
} from "@react-email/components";

interface OrderConfirmationEmailProps {
  firstName: string;
  orderCode: string; // e.g. "#ORD-TBP3C9"

  /**
   * ⚠️ Money arrives pre-formatted, as strings like "BDT 105.00" or
   * "JPY 1200" — this template never formats or computes anything.
   *
   * An email is the one place a bill can't be corrected after the fact:
   * it sits in an inbox forever, and it is what a customer forwards to
   * their accountant. So the figures are the ones the server already
   * committed to the Order row, in that order's own currency, rather than
   * anything recomputed at send time against today's settings.
   */
  items: { title: string; quantity: number; lineTotal: string }[];
  subtotal: string;
  discountAmount: string | null;
  serviceCharge: string | null;
  deliveryFee: string | null;
  taxAmount: string | null;
  taxName: string;
  taxIncluded: boolean;
  giftCardAmount: string | null;
  pointsRedeemedAmount: string | null;
  tipAmount: string | null;
  totalAmount: string;

  address: string;
  city: string;
  state: string;
  zip: string;
  shippingMethodLabel: string; // "Uber Eats" | "Food Panda"
  paymentMethodLabel: string; // "Cash on Delivery" | "Online Payment"
  trackingUrl: string;
}

/**
 * One line of the bill. Renders nothing at all when the value is null,
 * which is how the caller says "this order had no service charge" without
 * the template needing to know what a service charge is.
 */
function BillLine({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: string | null;
  negative?: boolean;
}) {
  if (!value) return null;

  return (
    <Row>
      <Column>
        <Text style={{ fontSize: "13px", color: "#6b7280", margin: "2px 0" }}>{label}</Text>
      </Column>
      <Column align="right">
        <Text
          style={{
            fontSize: "13px",
            color: negative ? "#2C6252" : "#374151",
            margin: "2px 0",
          }}
        >
          {negative ? "-" : ""}
          {value}
        </Text>
      </Column>
    </Row>
  );
}

const GREEN = "#2C6252";
const ORANGE = "#FF4C15";
const LOGO_URL =
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752050762/Group_22_fhiuuw.png";

export default function OrderConfirmationEmail({
  firstName,
  orderCode,
  items,
  subtotal,
  discountAmount,
  serviceCharge,
  deliveryFee,
  taxAmount,
  taxName,
  taxIncluded,
  giftCardAmount,
  pointsRedeemedAmount,
  tipAmount,
  totalAmount,
  address,
  city,
  state,
  zip,
  shippingMethodLabel,
  paymentMethodLabel,
  trackingUrl,
}: OrderConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your order {orderCode} has been placed — track it live</Preview>
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
            Thanks, {firstName}! Your order is in.
          </Heading>
          <Text style={{ color: "#6b7280", fontSize: "14px", marginTop: 0 }}>
            Order {orderCode} has been placed successfully.
          </Text>

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Link
              href={trackingUrl}
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
              Track your order live →
            </Link>
          </Section>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />

          <Text
            style={{
              color: "#6b7280",
              fontSize: "12px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Order Summary
          </Text>

          {items.map((item, i) => (
            <Row key={i} style={{ marginBottom: "4px" }}>
              <Column>
                <Text style={{ fontSize: "14px", color: "#374151", margin: "4px 0" }}>
                  {item.title} <span style={{ color: "#9ca3af" }}>x{item.quantity}</span>
                </Text>
              </Column>
              <Column align="right">
                <Text style={{ fontSize: "14px", color: "#374151", margin: "4px 0" }}>
                  {item.lineTotal}
                </Text>
              </Column>
            </Row>
          ))}

          <Hr style={{ borderColor: "#e5e7eb", borderStyle: "dashed", margin: "16px 0" }} />

          {/* The bill. Zero lines are omitted entirely, so a plain order still
              reads as a short receipt rather than a form with blanks. */}
          <BillLine label="Subtotal" value={subtotal} />
          <BillLine label="Discount" value={discountAmount} negative />
          <BillLine label="Service charge" value={serviceCharge} />
          <BillLine label="Delivery" value={deliveryFee} />
          <BillLine
            /* INCLUSIVE mode: the tax is already inside the prices above, so
               the total does not go up. In the EU this line is a legal
               requirement, not a courtesy — and saying "(included)" is what
               stops a customer reading it as a second charge. */
            label={taxIncluded ? `${taxName} (included)` : taxName}
            value={taxAmount}
          />
          <BillLine label="Gift card" value={giftCardAmount} negative />
          <BillLine label="Points redeemed" value={pointsRedeemedAmount} negative />
          <BillLine label="Tip" value={tipAmount} />

          <Hr style={{ borderColor: "#e5e7eb", borderStyle: "dashed", margin: "16px 0" }} />

          <Row>
            <Column>
              <Text style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                {shippingMethodLabel} &middot; {paymentMethodLabel}
              </Text>
            </Column>
            <Column align="right">
              <Text style={{ fontSize: "16px", fontWeight: "bold", color: GREEN, margin: 0 }}>
                {totalAmount}
              </Text>
            </Column>
          </Row>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />

          <Text
            style={{
              color: "#6b7280",
              fontSize: "12px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Delivering To
          </Text>
          <Text style={{ fontSize: "14px", color: "#374151", margin: "4px 0" }}>
            {address}, {city}, {state} {zip}
          </Text>

          <Text style={{ fontSize: "12px", color: "#9ca3af", marginTop: "32px" }}>
            This page updates automatically — click the tracking link above any time to see
            your order&apos;s live status.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}