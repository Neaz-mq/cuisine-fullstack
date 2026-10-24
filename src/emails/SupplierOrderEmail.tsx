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

export interface SupplierOrderEmailLine {
  name: string;
  /** Already formatted, e.g. "12 Kg". */
  quantity: string;
}

interface SupplierOrderEmailProps {
  supplierName: string;
  /** "PO-3F9K2A" — what both sides quote when they talk about this order. */
  orderRef: string;
  lines: SupplierOrderEmailLine[];
  note: string | null;
  /** The signed link to the accept page (lib/supplier-order-token.ts). */
  acceptUrl: string;
  /** True when staff pressed "Resend" — tells the supplier it's a repeat. */
  isReminder: boolean;
  previewText: string;
}

const GREEN = "#2C6252";
const ORANGE = "#FF4C15";

/**
 * src/emails/SupplierOrderEmail.tsx
 *
 * Sent to a supplier when staff restock an ingredient. One button: Accept.
 * Pressing it moves the order to "On the Way" and notifies the admins.
 *
 * ⚠️ Prices are left out on purpose — the cost on an ingredient is the last
 * price we paid, not a quote, and showing it would read like a binding offer.
 */
export default function SupplierOrderEmail({
  supplierName,
  orderRef,
  lines,
  note,
  acceptUrl,
  isReminder,
  previewText,
}: SupplierOrderEmailProps) {
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
            {isReminder ? "Reminder: " : ""}New order {orderRef}
          </Heading>
          <Text style={{ color: "#6b7280", fontSize: "14px", marginTop: 0 }}>
            Hi {supplierName}, Cuisine would like to order the items below. Please accept the order
            if you can deliver it — we&apos;ll be notified straight away.
          </Text>

          <Section
            style={{
              backgroundColor: "#f9f6f3",
              borderRadius: "8px",
              padding: "8px 16px",
              margin: "16px 0",
            }}
          >
            {lines.map((line) => (
              <table
                key={line.name}
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                style={{ borderBottom: "1px solid #ece6e0" }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: "10px 0", fontSize: "14px", color: "#1f2937" }}>
                      {line.name}
                    </td>
                    <td
                      align="right"
                      style={{
                        padding: "10px 0",
                        fontSize: "14px",
                        fontWeight: "bold",
                        color: "#1f2937",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {line.quantity}
                    </td>
                  </tr>
                </tbody>
              </table>
            ))}
          </Section>

          {note ? (
            <Text style={{ color: "#6b7280", fontSize: "13px", margin: "0 0 8px" }}>
              Note from the restaurant: {note}
            </Text>
          ) : null}

          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Link
              href={acceptUrl}
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
              View &amp; accept order →
            </Link>
          </Section>

          {/* Some clients strip button links — keep the URL visible too
              (same reason as PasswordResetEmail). */}
          <Text style={{ color: "#9ca3af", fontSize: "12px", margin: "0 0 4px" }}>
            Button not working? Paste this into your browser:
          </Text>
          <Text style={{ color: GREEN, fontSize: "12px", margin: 0, wordBreak: "break-all" }}>
            {acceptUrl}
          </Text>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />

          <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
            This link is only for you — please don&apos;t forward it. If this order isn&apos;t
            meant for you, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
