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
  items: { title: string; quantity: number; price: number }[];
  totalAmount: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  shippingMethodLabel: string; // "Uber Eats" | "Food Panda"
  paymentMethodLabel: string; // "Cash on Delivery" | "Online Payment"
  trackingUrl: string;
}

const GREEN = "#2C6252";
const ORANGE = "#FF4C15";
const LOGO_URL =
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752050762/Group_22_fhiuuw.png";

export default function OrderConfirmationEmail({
  firstName,
  orderCode,
  items,
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
                  ${(item.price * item.quantity).toFixed(2)}
                </Text>
              </Column>
            </Row>
          ))}

          <Hr style={{ borderColor: "#e5e7eb", borderStyle: "dashed", margin: "16px 0" }} />

          <Row>
            <Column>
              <Text style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
                {shippingMethodLabel} &middot; {paymentMethodLabel}
              </Text>
            </Column>
            <Column align="right">
              <Text style={{ fontSize: "16px", fontWeight: "bold", color: GREEN, margin: 0 }}>
                USD ${totalAmount.toFixed(2)}
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