import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { isStaffRole } from "@/lib/permissions";

/**
 * auth.config.ts
 *
 * এটা "edge-compatible" config — শুধু middleware.ts এটা import করে।
 * এখানে Prisma client, bcrypt, বা কোনো Node-only API রাখা যাবে না,
 * কারণ middleware edge runtime-এ চলে, যেখানে এগুলো কাজ করে না।
 *
 * Credentials provider (যেটা database query করে) এখানে নেই —
 * সেটা auth.ts-এ আছে, যেটা শুধু server-side API route/server component-এ
 * import হয়, middleware-এ না।
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    /**
     * ⚠️ token.role শুধু প্রথম login-এ লেখা হয় — `user` object কেবল
     * তখনই থাকে। এরপর প্রতিটা request-এ token যেমন ছিল তেমনই ফেরত
     * যায়, DB-র সাথে আর কোনো যোগাযোগ হয় না।
     *
     * অর্থাৎ token.role হলো "login-এর মুহূর্তে এই user-এর role কী
     * ছিল", "এখন কী" নয়। কাউকে MANAGER থেকে WAITER করে দিলে তার
     * চলমান token এখনো MANAGER-ই বলবে।
     *
     * তাই এই মানটা কখনো authorization-এর ভিত্তি হিসেবে ব্যবহার করা
     * যাবে না। lib/require-admin.ts প্রতি request-এ DB থেকে আসল role
     * পড়ে নেয়; এখানকার role শুধু UI-র জন্য (কোন menu দেখাব) আর
     * নিচের middleware-এর মোটা দাগের filter-এর জন্য।
     */
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
    // middleware এই callback ব্যবহার করে route protection-এর জন্য
    // এখানে কোনো database query নেই, শুধু token/session চেক।
    //
    // এটা ইচ্ছাকৃতভাবে মোটা দাগের: "staff role আছে কি নেই" — কোন scope
    // আছে সেটা নয়, আর role টাটকা কিনা সেটাও নয়। edge runtime-এ Prisma
    // চলে না, তাই এখানে DB দেখা সম্ভবই নয়। আসল সীমানা হলো
    // lib/require-admin.ts, যেটা প্রতিটা admin page ও API route-এ চলে।
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = request.nextUrl.pathname.startsWith("/admin");
      const isOnAccount = request.nextUrl.pathname.startsWith("/account");

      if (isOnAdmin) {
        return isLoggedIn && isStaffRole((auth?.user as { role?: string })?.role);
      }

      if (isOnAccount) {
        return isLoggedIn;
      }

      return true;
    },
  },
  session: {
    strategy: "jwt",
    // NextAuth-এর default ৩০ দিন — এই app-এর জন্য অনেক বেশি। দুটো কারণ:
    //
    // ১. role JWT-তে বসে থাকে (উপরের jwt callback-এর নোট দ্রষ্টব্য), তাই
    //    role বদলালেও পুরোনো token পুরোনো মান বহন করতে থাকে।
    //    require-admin.ts এখন প্রতি request-এ DB থেকে role পড়ে বলে সেটা
    //    আর ভুল access দেয় না — কিন্তু token-এর আয়ু ছোট রাখাটা দ্বিতীয়
    //    স্তরের সুরক্ষা, একটা guard কোথাও বাদ পড়লে যেটা কাজে লাগে।
    //
    // ২. রেস্তোরাঁয় terminal শেয়ার করা হয়। একজন waiter shift শেষে উঠে
    //    যায়, পরেরজন একই screen-এ বসে — ৩০ দিনের session সেখানে
    //    বাস্তবসম্মত নয়। ৮ ঘণ্টা মোটামুটি একটা shift।
    maxAge: 8 * 60 * 60,
  },
};