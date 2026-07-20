"use client";

import { useState, useEffect, memo, useCallback } from "react";
import { motion as Motion } from "framer-motion";
import Image from "next/image";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";
import { toast } from "react-toastify";
import { BsCartX } from "react-icons/bs";

interface FoodItem {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
}

interface FoodCardProps {
  item: FoodItem;
  index: number;
  onAddToCart: (item: FoodItem) => void;
  isKitchenOpen: boolean;
}

// Separate data from component for cleaner code
const weeklyFoodData: FoodItem[] = [
  {
    id: "crispy-chicken-wings",
    title: "Crispy Chicken Wings",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752131105/menu14_ic1vqr.webp",
  },
  {
    id: "santas-stuffed-mushrooms",
    title: "Santa's Stuffed Mushrooms",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752131180/menu15_b2jpqw.webp",
  },
  {
    id: "classic-roast-brew",
    title: "Classic Roast Brew",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752131250/menu16_kvd8lx.webp",
  },
  {
    id: "cheesy-crust-deluxe",
    title: "Cheesy Crust Deluxe",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 16,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752131326/menu17_i0xaie.webp",
  },
];

// Same restaurant-hours logic as TopBar/Signature/Deliver/Items — keep in sync if you change one
const KITCHEN_OPEN_HOUR = 10;
const KITCHEN_CLOSE_HOUR = 22;

// Reusable food card component
const FoodCard = memo(({ item, index, onAddToCart, isKitchenOpen }: FoodCardProps) => (
  <Motion.article
    className="bg-[#F8F8F8] overflow-hidden flex flex-col p-6"
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.15 }}
    viewport={{ once: true }}
    whileHover={{ scale: 1.02 }}
    aria-label={`${item.title} - ${item.description}, $${item.price}/pcs`}
  >
    <div className="relative w-full 3xl:h-60 2xl:h-60 xl:h-40 lg:h-36 md:h-36 sm:h-36 overflow-hidden">
      <Image
        src={item.image}
        alt={item.title}
        fill
        sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
        className="object-cover"
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
      <p className="text-xs text-[#CCCCCC] mb-4 flex-grow mt-2">{item.description}</p>
      <div className="flex justify-between items-center mt-auto">
        <span className="3xl:text-3xl 2xl:text-3xl xl:text-3xl lg:text-xl font-bold text-[#2C6252]">
          ${item.price}
          <span className="text-lg text-[#B9B9B9] relative top-2 left-1 font-semibold">/ pcs</span>
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
              <Image src="/Path 2764.svg" alt="Add to cart icon" width={14} height={14} className="w-5 h-5" />
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
FoodCard.displayName = "FoodCard";

const Weekly = () => {
  const { addToCart, cartItems } = useCart();
  const [showMore, setShowMore] = useState<boolean>(false);
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(false);
  const [isKitchenOpen, setIsKitchenOpen] = useState<boolean>(true);

  // Check screen size
  useEffect(() => {
    const handleResize = () => setIsSmallScreen(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Check kitchen availability (10:00 - 22:00)
  useEffect(() => {
    const checkKitchenStatus = () => {
      const now = new Date();
      const hours = now.getHours();
      setIsKitchenOpen(hours >= KITCHEN_OPEN_HOUR && hours < KITCHEN_CLOSE_HOUR);
    };
    checkKitchenStatus();
    const interval = setInterval(checkKitchenStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Cart handler
  const handleAddToCart = useCallback(
    (item: FoodItem) => {
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
        imageUrl: item.image,
      });
      toast.success(`${item.title} added to cart!`, {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
      });
    },
    [addToCart, cartItems],
  );

  const visibleItems = isSmallScreen && !showMore ? weeklyFoodData.slice(0, 2) : weeklyFoodData;

  return (
    <Container>
      <div className="sm:px-4 md:px-6 3xl:px-[3.5rem] 2xl:px-4 xl:px-14 lg:px-14 3xl:ml-2 2xl:ml-0 xl:ml-0 lg:-ml-16 md:-ml-16 sm:-ml-[6.5rem] 3xl:mt-24 2xl:mt-20 xl:mt-16 lg:mt-12 md:mt-12 sm:mt-2">
        <div className="py-8 3xl:mb-8 2xl:mb-6 xl:mb-6 lg:mb-4 md:mb-4 sm:mb-4">
          <header className="mb-10 text-center md:text-left">
            <h2 className="3xl:text-4xl 2xl:text-4xl xl:text-3xl lg:text-2xl md:text-2xl sm:text-xl font-semibold text-[#2C6252] mb-2">
              Our Signature<span className="font-bold ml-2">Foods</span>
            </h2>
            <p className="3xl:text-lg 2xl:text-lg xl:text-sm lg:text-sm md:text-sm sm:text-sm text-[#B9B9B9]">
              Discover anything you need, the easy way
            </p>
          </header>

          <div
            className="relative w-full h-[400px] bg-cover bg-center overflow-hidden mb-16"
            style={{
              backgroundImage:
                "url('https://res.cloudinary.com/dxohwanal/image/upload/v1752054831/young-smiling-courier-guy-red-uniform-sitting-scooter-holding-paper-bag-saying-hello-white-wall_haw6vn_hdlpgf.webp')",
            }}
            role="img"
            aria-label="Delivery man holding paper bag on scooter"
          >
            <div className="absolute top-0 right-0 w-full md:w-1/2 h-full bg-[#2C6252] bg-opacity-90 flex items-center justify-center p-8 md:rounded-bl-none text-white 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-lg md:text-sm sm:text-sm font-medium text-center md:text-left shadow-lg">
              <p className="max-w-md">
                Whether you&apos;re craving a hearty meal, a sweet treat, or a refreshing coffee —{" "}
                <span className="text-[#FF4D00]">our signature foods</span> have something for everyone.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4 3xl:gap-10">
            {visibleItems.map((item, index) => (
              <FoodCard
                key={item.id}
                item={item}
                index={index}
                onAddToCart={handleAddToCart}
                isKitchenOpen={isKitchenOpen}
              />
            ))}
          </div>

          {isSmallScreen && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setShowMore((prev) => !prev)}
                className="bg-white text-[#2C6252] p-3 rounded-full shadow-lg"
                aria-label={showMore ? "Show less menu items" : "Show more menu items"}
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {showMore ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
};

export default Weekly;