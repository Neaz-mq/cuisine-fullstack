"use client";

import { useState, useEffect } from "react";
import { motion as Motion } from "framer-motion";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";
import { toast } from "react-toastify";

// ---------------------------------------------------------------------------
// Real menu data, fetched from GET /api/menu (DB-backed) — replaces the
// hardcoded `categoryItems` array this file used to render.
//
// Why this mattered beyond "the menu should be editable without a
// redeploy": every cart line created from this page used to be keyed by
// `slugify(item.title)`, NOT a real MenuItem.id, because there was no real
// id to send. Checkout then had to re-resolve each cart line back to a
// MenuItem by matching on title (see the now-removed "temporary shim" in
// src/lib/order-checkout-shared.ts) — fragile, and silently wrong if two
// items ever shared a title or a title was edited in the DB without
// updating this hardcoded copy. Using the real `id` from the API closes
// that gap.
//
// Dropped in this pass (decorative-only, no DB backing, and out of scope
// per the priority discussion): `originalPrice` strikethrough pricing,
// `hasOrderButton` (some hardcoded items had no order button at all), and
// the per-category "Today's Special" hero block. All three can come back
// later as real schema-backed features if wanted.
// ---------------------------------------------------------------------------

interface ApiMenuItem {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
}

interface ApiCategory {
  id: string;
  label: string;
  items: ApiMenuItem[];
}

// Category has no icon/image field in the schema — fall back to its first
// item's photo, then to a neutral placeholder if the category somehow has
// no images at all, rather than a broken <img>.
const FALLBACK_CATEGORY_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23138261" stroke-width="1.5"><circle cx="12" cy="12" r="9"/></svg>`
  );

const KITCHEN_OPEN_HOUR = 10;
const KITCHEN_CLOSE_HOUR = 22;
const CATEGORIES_PER_VIEW = 3;

const Items = () => {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [startIndex, setStartIndex] = useState<number>(0);
  const [showAllItemsSm, setShowAllItemsSm] = useState<boolean>(false);
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(false);
  const [isKitchenOpen, setIsKitchenOpen] = useState<boolean>(true);
  const { addToCart } = useCart();

  useEffect(() => {
    let isMounted = true;

    async function fetchMenu() {
      try {
        const res = await fetch("/api/menu");
        if (!res.ok) throw new Error("Failed to load menu");
        const data: ApiCategory[] = await res.json();
        if (!isMounted) return;
        setCategories(data);
        if (data.length > 0) setSelected(data[0].label);
      } catch (err) {
        console.error("Failed to load menu:", err);
        if (isMounted) setLoadError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchMenu();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const checkKitchenStatus = () => {
      const now = new Date();
      const hours = now.getHours();
      setIsKitchenOpen(
        hours >= KITCHEN_OPEN_HOUR && hours < KITCHEN_CLOSE_HOUR,
      );
    };

    checkKitchenStatus();
    const interval = setInterval(checkKitchenStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    setShowAllItemsSm(false);
  }, [selected]);

  if (isLoading) {
    return (
      <Container>
        <p className="text-center mt-32 mb-32 text-gray-500" role="status">
          Loading menu…
        </p>
      </Container>
    );
  }

  if (loadError) {
    return (
      <Container>
        <p className="text-center mt-32 mb-32 text-red-500" role="alert">
          Couldn&apos;t load the menu right now. Please refresh the page.
        </p>
      </Container>
    );
  }

  if (categories.length === 0) {
    return (
      <Container>
        <p className="text-center mt-32 mb-32 text-gray-500" role="status">
          The menu is being updated — please check back soon.
        </p>
      </Container>
    );
  }

  const selectedCategoryData = categories.find((c) => c.label === selected);
  if (!selectedCategoryData) {
    return (
      <Container>
        <p className="text-center mt-64 text-red-500" role="alert">
          Category not found.
        </p>
      </Container>
    );
  }

  const items = selectedCategoryData.items;
  const totalCategories = categories.length;

  const handleNextCategories = () => {
    setStartIndex((prev) => (prev + 1) % totalCategories);
  };

  const getVisibleCategories = (): ApiCategory[] => {
    const currentVisible: ApiCategory[] = [];
    for (let i = 0; i < Math.min(CATEGORIES_PER_VIEW, totalCategories); i++) {
      currentVisible.push(categories[(startIndex + i) % totalCategories]);
    }
    return currentVisible;
  };
  const visibleCategories = getVisibleCategories();

  const displayedItems = isSmallScreen
    ? showAllItemsSm
      ? items
      : items.slice(0, 2)
    : items;

  const showToggleButtonSm = items.length > 2 && isSmallScreen;
  const toggleShowAllItemsSm = () => setShowAllItemsSm((prev) => !prev);

  const handleOrderNow = (item: ApiMenuItem) => {
    if (!isKitchenOpen) {
      toast.error("Kitchen is currently closed! Try again later.");
      return;
    }

    addToCart({
      id: item.id,
      title: item.title,
      price: item.price,
      quantity: 1,
      imageUrl: item.imageUrl ?? undefined,
      description: item.description,
    });

    toast.success(`${item.title} added to cart!`);
  };

  return (
    <Container>
      <section
        aria-label="Food Categories Navigation and Menu Items"
        className="3xl:mt-32 2xl:mt-28 xl:mt-20 lg:mt-6 md:mt-6 sm:mt-4 3xl:ml-[4rem] 3xl:mr-12 2xl:ml-4 2xl:mr-10 xl:ml-14 xl:mr-12 lg:-ml-3 lg:mr-16 md:-ml-12 md:mr-4 sm:-ml-[7rem] sm:mr-0 overflow-hidden"
      >
        {/* Category Navigation */}
        <nav
          aria-label="Food categories"
          className="bg-[#2C6252] py-8 flex justify-center px-4 relative"
        >
          {/* Desktop categories */}
          <div className="hidden lg:flex 3xl:space-x-24 2xl:space-x-20 xl:space-x-20 lg:space-x-16">
            {categories.map((category) => (
              <Motion.button
                key={category.label}
                onClick={() => setSelected(category.label)}
                className="flex flex-col items-center cursor-pointer relative bg-transparent border-none outline-none"
                aria-current={selected === category.label ? "true" : "false"}
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
                type="button"
              >
                <Motion.img
                  src={category.items[0]?.imageUrl ?? FALLBACK_CATEGORY_ICON}
                  alt={`${category.label} category icon`}
                  className="3xl:w-14 3xl:h-14 2xl:w-14 2xl:h-14 xl:w-14 xl:h-14 lg:w-12 lg:h-12 md:w-10 md:h-10 sm:w-6 sm:h-6 object-cover rounded-full"
                  initial={{ rotate: 0 }}
                  whileHover={{ rotate: 10 }}
                  transition={{ type: "spring", stiffness: 200 }}
                />
                <span
                  className={`mt-4 text-xs font-semibold ${selected === category.label ? "text-white" : "text-[#138261]"}`}
                >
                  {category.label}
                </span>
                {selected === category.label && (
                  <div
                    className="absolute bottom-0 w-full h-1 -mb-4"
                    aria-hidden="true"
                  />
                )}
              </Motion.button>
            ))}
          </div>

          {/* Mobile/Tablet categories */}
          <div className="flex lg:hidden sm:w-44 md:w-full justify-between items-center relative">
            {visibleCategories.map((category) => (
              <Motion.button
                key={category.label}
                onClick={() => setSelected(category.label)}
                className="flex flex-col items-center cursor-pointer relative bg-transparent border-none outline-none flex-1"
                aria-current={selected === category.label ? "true" : "false"}
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
                type="button"
              >
                <Motion.img
                  src={category.items[0]?.imageUrl ?? FALLBACK_CATEGORY_ICON}
                  alt={`${category.label} category icon`}
                  className="md:w-10 md:h-10 sm:w-6 sm:h-6 object-cover rounded-full"
                  initial={{ rotate: 0 }}
                  whileHover={{ rotate: 10 }}
                  transition={{ type: "spring", stiffness: 200 }}
                />
                <span
                  className={`mt-4 sm:text-[8px] md:text-[10px] font-semibold ${
                    selected === category.label ? "text-white" : "text-[#138261]"
                  }`}
                >
                  {category.label}
                </span>
                {selected === category.label && (
                  <div
                    className="absolute bottom-0 w-full h-1 -mb-4"
                    aria-hidden="true"
                  />
                )}
              </Motion.button>
            ))}
            {totalCategories > CATEGORIES_PER_VIEW && (
              <button
                onClick={handleNextCategories}
                className="absolute sm:-right-9 md:right-2 bg-transparent border-none outline-none cursor-pointer p-2 rounded-full md:top-3 sm:top-0 z-10"
                aria-label="Next categories"
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        </nav>

        {/* Main Content — Menu Items (Today's Special hero dropped; it had
            no DB backing and was decorative-only, see file header note) */}
        <div className="bg-white py-12 px-4 3xl:px-0 2xl:px-14 xl:px-14 lg:px-14 md:px-14 sm:px-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mt-10">
          {displayedItems.map((item) => (
            <article
              key={item.id}
              className="bg-[#F8F8F8] 3xl:p-12 2xl:p-12 xl:p-12 lg:p-10 md:p-10 sm:p-10 flex flex-col items-start h-96"
            >
              <h2 className="3xl:text-lg 2xl:text-lg xl:text-lg md:text-lg sm:text-sm font-semibold text-[#2C6252]">
                {item.title}
              </h2>
              <p className="text-gray-500 3xl:text-sm 2xl:text-sm xl:text-sm md:text-sm sm:text-xs mt-4 mb-4">
                {item.description}
              </p>
              <div className="flex sm:flex-col md:flex-row items-center md:justify-between w-full mt-auto">
                {item.imageUrl && (
                  <Motion.img
                    src={item.imageUrl}
                    alt={`${item.title} image`}
                    className="w-40 h-auto object-contain -ml-4"
                    animate={selected?.toUpperCase() === "PIZZA" ? { rotate: 360 } : {}}
                    transition={
                      selected?.toUpperCase() === "PIZZA"
                        ? { repeat: Infinity, duration: 10, ease: "linear" }
                        : { type: "spring", stiffness: 100 }
                    }
                  />
                )}
                <div className="flex flex-col sm:items-center md:items-end">
                  <div className="flex items-end gap-x-1 sm:mt-2 md:mt-0">
                    <div className="3xl:text-2xl 2xl:text-2xl xl:text-2xl lg:text-lg md:text-lg sm:text-sm font-bold text-[#2C6252] leading-none">
                      ${item.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="relative inline-block group w-max md:top-8 sm:mt-2">
                    <Motion.button
                      disabled={!isKitchenOpen}
                      className={`text-white text-xs sm:text-sm font-bold px-3 py-2 whitespace-nowrap rounded-sm w-full ${
                        isKitchenOpen
                          ? "bg-[#FF4C15] cursor-pointer hover:bg-orange-600"
                          : "bg-gray-400 cursor-not-allowed text-gray-200 text-sm sm:text-base"
                      }`}
                      whileTap={isKitchenOpen ? { scale: 0.95 } : {}}
                      onClick={() => handleOrderNow(item)}
                      aria-label={
                        isKitchenOpen
                          ? `Order now: ${item.title}`
                          : `${item.title} unavailable`
                      }
                      type="button"
                    >
                      {isKitchenOpen ? "Order Now" : "Unavailable"}
                    </Motion.button>

                    {!isKitchenOpen && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-center text-[10px] sm:text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-sm whitespace-nowrap">
                        Kitchen will open at {KITCHEN_OPEN_HOUR} AM
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}

          {/* Show More/Less button */}
          {showToggleButtonSm && (
            <div className="flex justify-center col-span-full">
              <button
                onClick={toggleShowAllItemsSm}
                className="bg-white text-[#2C6252] p-3 rounded-full shadow-lg"
                aria-label={
                  showAllItemsSm
                    ? "Show less menu items"
                    : "Show more menu items"
                }
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {showAllItemsSm ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  )}
                </svg>
              </button>
            </div>
          )}
        </div>
      </section>
    </Container>
  );
};

export default Items;