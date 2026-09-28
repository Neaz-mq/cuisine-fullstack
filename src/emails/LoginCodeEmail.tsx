import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import EmailLogo from "@/emails/EmailLogo";

/**
 * The 6-digit code for two-step sign-in (lib/login-code.ts). Same look as
 * the other Cuisine emails: logo, heading, the code in a cream box.
 */
export default function LoginCodeEmail({
  firstName,
  code,
  purpose,
  minutes,
}: {
  firstName: string;
  code: string;
  purpose: "LOGIN" | "ENABLE_2FA";
  minutes: number;
}) {
  const signingIn = purpose === "LOGIN";
  return (
    <Html>
      <Head />
      <Preview>{`${code} — your Cuisine ${signingIn ? "sign-in" : "verification"} code`}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "Arial, sans-serif" }}>
        <Container
          style={{ backgroundColor: "#ffffff", margin: "0 auto", padding: "32px 24px", maxWidth: "560px", borderRadius: "8px" }}
        >
          <EmailLogo />
          <Heading style={{ color: "#1f2937", fontSize: "20px", marginBottom: "4px" }}>
            {signingIn ? "Your sign-in code" : "Turn on two-step sign-in"}
          </Heading>
          <Text style={{ color: "#1f2937", fontSize: "15px", lineHeight: "1.6" }}>
            Hi {firstName}, {signingIn ? "enter this code to finish signing in to Cuisine:" : "enter this code on the Change Password page to turn on two-step sign-in:"}
          </Text>
          <Section style={{ backgroundColor: "#F9F6F3", borderRadius: "12px", padding: "20px", margin: "16px 0", textAlign: "center" }}>
            <Text style={{ color: "#000000", fontSize: "32px", fontWeight: "bold", letterSpacing: "8px", margin: 0 }}>{code}</Text>
          </Section>
          <Text style={{ color: "#6b7280", fontSize: "13px", lineHeight: "1.6" }}>
            The code works for {minutes} minutes. Never share it — Cuisine will never ask you for it.
          </Text>
          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />
          <Text style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
            {signingIn
              ? "Didn't try to sign in? Someone may know your password — please change it from My Account → Change Password."
              : "Didn't ask for this? You can ignore this email; nothing changes."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
