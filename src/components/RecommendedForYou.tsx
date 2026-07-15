"use client";

import { useState, useEffect, memo, useCallback } from "react";
import { motion as Motion } from "framer-motion";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";
import { toast } from "react-toastify";
import { BsCartX } from "react-icons/bs";
import type { RecommendedMenuItem, Recommendations } from "@/lib/recommendations";

// Same restaurant-hours logic as Weekly/Items/Signature — keep in sync if
// you change one.
const KITCHEN_OPEN_HOUR = 10;
const KITCHEN_CLOSE_HOUR = 22;

interface FoodCardProps {
  item: RecommendedMenuItem;
  index: number;
  onAddToCart: (item: RecommendedMenuItem) => void;
  isKitchenOpen: boolean;
}

const FoodCard = memo(({ item, index, onAddToCart, isKitchenOpen }: FoodCardProps) => (
  <Motion.article
    className="bg-[#F8F8F8] overflow-hidden flex flex-col p-6"
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
    viewport={{ once: true }}
    whileHover={{ scale: 1.02 }}
    aria-label={`${item.title} - ${item.description}, $${item.price}`}
  >
    <div className="w-full 3xl:h-60 2xl:h-60 xl:h-40 lg:h-36 md:h-36 sm:h-36 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl || "https://placehold.co/400x240/CCCCCC/FFFFFF?text=Cuisine"}
        alt={item.title}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "https://placehold.co/400x240/CCCCCC/FFFFFF?text=Image+Not+Found";
        }}
      />
    </div>

    <div className="flex flex-col flex-grow mt-6">
      <h3 className="3xl:text-xl 2xl:text-xl xl:text-xl lg:text-[14px] md:text-[14px] sm:text-[14px] font-semibold text-[#2C6252] leading-tight mb-1">
        {item.title}
      </h3>
      <p className="text-xs text-[#CCCCCC] mb-4 flex-grow mt-2 line-clamp-2">{item.description}</p>
      <div className="flex justify-between items-center mt-auto">
        <span className="3xl:text-3xl 2xl:text-3xl xl:text-3xl lg:text-xl font-bold text-[#2C6252]">
          ${item.price.toFixed(2)}
        </span>
        <div className="relative inline-block group">
          <button
            disabled={!isKitchenOpen}
            className={`p-2 flex items-center justify-center rounded-sm w-10 h-10 ${
              isKitchenOpen
                ? "bg-[#2C6252] text-white hover:bg-[#1F4B3C] cursor-pointer"
                : "bg-gray-400 text-gray-200 cursor-not-allowed"
            }`}
            onClick={() => isKitchenOpen && onAddToCart(item)}
            aria-label={isKitchenOpen ? `Add ${item.title} to cart` : `${item.title} unavailable`}
            type="button"
          >
            {isKitchenOpen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/Path 2764.svg" alt="Add to cart icon" className="w-5 h-5" />
            ) : (
              <BsCartX size={20} className="animate-pulse" />
            )}
          </button>
          {!isKitchenOpen && (
            <div className="absolute -top-6 -left-28 px-3 py-1 bg-black text-white text-center text-[10px] sm:text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-sm whitespace-normal w-max max-w-[160px]">
              Kitchen will open at {KITCHEN_OPEN_HOUR} AM
            </div>
          )}
        </div>
      </div>
    </div>
  </Motion.article>
));
FoodCard.displayName = "RecommendedFoodCard";

function Row({
  title,
  subtitle,
  items,
  onAddToCart,
  isKitchenOpen,
}: {
  title: string;
  subtitle: string;
  items: RecommendedMenuItem[];
  onAddToCart: (item: RecommendedMenuItem) => void;
  isKitchenOpen: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-14">
      <header className="mb-6 text-center md:text-left">
        <h2 className="3xl:text-3xl 2xl:text-3xl xl:text-2xl lg:text-xl md:text-xl sm:text-lg font-semibold text-[#2C6252] mb-1">
          {title}
        </h2>
        <p className="text-sm text-[#B9B9B9]">{subtitle}</p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4 3xl:gap-10">
        {items.map((item, index) => (
          <FoodCard
            key={item.id}
            item={item}
            index={index}
            onAddToCart={onAddToCart}
            isKitchenOpen={isKitchenOpen}
          />
        ))}
      </div>
    </div>
  );
}

const RecommendedForYou = () => {
  const { addToCart, cartItems } = useCart();
  const [data, setData] = useState<Recommendations | null>(null);
  const [isKitchenOpen, setIsKitchenOpen] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/recommendations")
      .then((res) => res.json())
      .then((json: Recommendations) => setData(json))
      .catch(() => setData({ personalized: false, orderAgain: [], recommended: [] }));
  }, []);

  useEffect(() => {
    const checkKitchenStatus = () => {
      const hours = new Date().getHours();
      setIsKitchenOpen(hours >= KITCHEN_OPEN_HOUR && hours < KITCHEN_CLOSE_HOUR);
    };
    checkKitchenStatus();
    const interval = setInterval(checkKitchenStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAddToCart = useCallback(
    (item: RecommendedMenuItem) => {
      const isAlreadyInCart = cartItems.some((cartItem) => cartItem.id === item.id);
      if (isAlreadyInCart) {
        toast.warning(`${item.title} is already in cart!`, {
          position: "top-center",
          autoClose: 2000,
          hideProgressBar: true,
        });
        return;
      }

      addToCart({
        id: item.id,
        title: item.title,
        price: item.price,
        quantity: 1,
        imageUrl: item.imageUrl || undefined,
      });
      toast.success(`${item.title} added to cart!`, {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
      });
    },
    [addToCart, cartItems]
  );

  // Nothing to show yet (still loading) or genuinely nothing to recommend
  // (e.g. brand-new restaurant with zero orders ever placed) — don't render
  // an empty/awkward section either way.
  if (!data || (data.orderAgain.length === 0 && data.recommended.length === 0)) {
    return null;
  }

  return (
    <Container>
      <div className="sm:px-4 md:px-6 3xl:px-[3.5rem] 2xl:px-4 xl:px-14 lg:px-14 3xl:ml-2 2xl:ml-0 xl:ml-0 lg:-ml-16 md:-ml-16 sm:-ml-[6.5rem] 3xl:mt-16 2xl:mt-14 xl:mt-12 lg:mt-10 md:mt-10 sm:mt-6">
        <div className="py-4">
          {data.personalized && (
            <Row
              title="Order Again"
              subtitle="Your usual favorites, one tap away"
              items={data.orderAgain}
              onAddToCart={handleAddToCart}
              isKitchenOpen={isKitchenOpen}
            />
          )}
          <Row
            title={data.personalized ? "Recommended For You" : "Popular Right Now"}
            subtitle={
              data.personalized
                ? "Picked based on what customers like you order"
                : "Customer favorites this week"
            }
            items={data.recommended}
            onAddToCart={handleAddToCart}
            isKitchenOpen={isKitchenOpen}
          />
        </div>
      </div>
    </Container>
  );
};

export default RecommendedForYou;