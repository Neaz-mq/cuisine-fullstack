"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

/**
 * src/components/AuthProvider.tsx
 *
 * next-auth/react এর signIn(), useSession(), signOut() ব্যবহার করতে হলে
 * পুরো app-কে SessionProvider দিয়ে wrap করতে হয়। যেহেতু root layout.tsx
 * সাধারণত Server Component, তাই এই client wrapper আলাদা বানানো হয়েছে।
 *
 * ব্যবহার (src/app/layout.tsx-এ):
 *
 *   import AuthProvider from "@/components/AuthProvider";
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html lang="en">
 *         <body>
 *           <AuthProvider>{children}</AuthProvider>
 *         </body>
 *       </html>
 *     );
 *   }
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
