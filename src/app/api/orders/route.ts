import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * src/app/api/orders/route.ts
 *
 * GET  /api/orders   -> all orders, for the admin dashboard (ADMIN only)
 * POST /api/orders    -> create a real order from the cart (public — guest
 *                         checkout is allowed, matching /carts which isn't
 *                         behind auth; we attach the account if logged in)
 *
 * ---------------------------------------------------------------------
 * IMPORTANT — temporary shim, read before touching this file:
 * ---------------------------------------------------------------------
 * The menu-display components (Items.tsx, Popular.tsx, Brew.tsx, etc.)
 * still render a hardcoded menu array instead of fetching from the DB, so
 * CartContext items carry `id: slugify(title)` — NOT a real MenuItem.id.
 * Until those components are wired to a future GET /api/menu, we can't
 * trust the cart's `id` as a foreign key.
 *
 * As a stopgap, this route resolves each cart line to a real MenuItem by
 * matching on `title` (case-insensitive) instead of id. This is fragile —
 * it breaks if two menu items ever share a title, or if a title is edited
 * in the DB without updating the hardcoded frontend copy. Once the menu
 * components fetch real data and pass through the real MenuItem.id, switch
 * this route back to a plain `menuItemId` lookup and delete this shim.
 * ---------------------------------------------------------------------
 */

const SHIPPING_METHODS = ["UBER_EATS", "FOOD_PANDA"] as const;
const PAYMENT_METHODS = ["COD", "ONLINE"] as const;

type ShippingMethod = (typeof SHIPPING_METHODS)[number];
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface IncomingItem {
  title: string;
  quantity: number;
}

interface Billing {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  address: string;
  apartment?: string;
  city: string;
  state: string;
  zip: string;
}

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: { include: { menuItem: true } } },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Failed to fetch order list" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      items,
      billing,
      shippingMethod,
      paymentMethod,
    }: {
      items: IncomingItem[];
      billing: Billing;
      shippingMethod: ShippingMethod;
      paymentMethod: PaymentMethod;
    } = body;

    // ---- Basic validation ----
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    const requiredBillingFields: (keyof Billing)[] = [
      "email",
      "firstName",
      "lastName",
      "phone",
      "country",
      "address",
      "city",
      "state",
      "zip",
    ];
    const missingField = requiredBillingFields.find((f) => !billing?.[f]?.trim());
    if (missingField) {
      return NextResponse.json(
        { error: `Billing field "${missingField}" is required` },
        { status: 400 }
      );
    }

    if (!SHIPPING_METHODS.includes(shippingMethod)) {
      return NextResponse.json(
        { error: "Invalid shipping method" },
        { status: 400 }
      );
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 }
      );
    }

    // ---- Resolve each cart line to a real, available MenuItem ----
    // Prices always come from the DB, never from the client — a tampered
    // request shouldn't be able to check out at a different price.
    const resolvedItems: { menuItemId: string; price: number; quantity: number; title: string }[] = [];
    const notFoundTitles: string[] = [];

    for (const item of items) {
      if (!item.title || !Number.isInteger(item.quantity) || item.quantity < 1) {
        return NextResponse.json(
          { error: "Each cart item needs a title and a positive integer quantity" },
          { status: 400 }
        );
      }

      const menuItem = await prisma.menuItem.findFirst({
        where: {
          title: { equals: item.title, mode: "insensitive" },
          isAvailable: true,
        },
      });

      if (!menuItem) {
        notFoundTitles.push(item.title);
        continue;
      }

      resolvedItems.push({
        menuItemId: menuItem.id,
        price: menuItem.price,
        quantity: item.quantity,
        title: menuItem.title,
      });
    }

    if (notFoundTitles.length > 0) {
      return NextResponse.json(
        {
          error: `These items are no longer available, please remove them from your cart: ${notFoundTitles.join(", ")}`,
        },
        { status: 409 }
      );
    }

    const totalAmount = resolvedItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );

    const session = await auth();

    const order = await prisma.order.create({
      data: {
        status: "PLACED",
        totalAmount,
        email: billing.email,
        firstName: billing.firstName,
        lastName: billing.lastName,
        phone: billing.phone,
        country: billing.country,
        address: billing.address,
        apartment: billing.apartment || null,
        city: billing.city,
        state: billing.state,
        zip: billing.zip,
        shippingMethod,
        paymentMethod,
        userId: session?.user?.id ?? null,
        items: {
          create: resolvedItems.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
      include: { items: { include: { menuItem: true } } },
    });

    // NOTE: paymentMethod "ONLINE" is recorded here but no card is actually
    // charged — there's no payment processor wired up yet (Stripe is an
    // installed dependency but unused). Treat online orders as
    // "payment intent captured on the honor system" until Stripe (or
    // another processor) is integrated.

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}