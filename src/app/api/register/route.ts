import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/validations/parse";
import { registerSchema } from "@/lib/validations/auth";

/**
 * src/app/api/register/route.ts
 *
 * Endpoint for creating a new account with Email + Password.
 * Users who sign up via Google don't need this route —
 * they go straight through signIn("google"), and NextAuth itself
 * creates the User row the first time (since we're not using
 * PrismaAdapter, this manual flow is handled in the signIn
 * callback inside auth.ts, where the User-creation logic for
 * Google login lives, since we're using the JWT strategy).
 */
export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, registerSchema);
    if (parsed instanceof NextResponse) return parsed;
    const { name, email, password } = parsed;

    // ---- Check if email already exists ----
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // ---- Hash password and create User ----
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
        role: "CUSTOMER",
      },
    });

    // ---- Not returning password in response (security) ----
    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register API error:", error);
    return NextResponse.json(
      { error: "A server error occurred, please try again later" },
      { status: 500 }
    );
  }
}