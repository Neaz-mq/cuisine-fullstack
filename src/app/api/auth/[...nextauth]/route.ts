import { handlers } from "@/auth";

/**
 * src/app/api/auth/[...nextauth]/route.ts
 *
 * এই catch-all route-ই /api/auth/* এর সব request handle করে:
 * sign-in, sign-out, callback (Google redirect ফিরে আসার পর), session ইত্যাদি।
 */
export const { GET, POST } = handlers;
