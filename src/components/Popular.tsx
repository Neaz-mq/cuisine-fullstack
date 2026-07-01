"use client";

import { useState, useEffect } from "react";
import { motion as Motion } from "framer-motion";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";
import { toast } from "react-toastify";
import Link from "next/link";
import { BsCartX } from "react-icons/bs";

interface FoodItem {
  id: number;
  title: string;
  description: string;
  price: number;
  image: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.42, 0, 0.58, 1] },
  }),
};

const foodItems: FoodItem[] = [
  {
    id: 1,
    title: "Classic Roast Brew",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
  },
  {
    id: 2,
    title: "Cheesy Crust Deluxe",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
  },
  {
    id: 3,
    title: "Classic Roast Special",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 16,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
  },
  {
    id: 4,
    title: "Cheesy Crust Superior",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 18,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
  },
];

// Kitchen hours check
const isKitchenOpen = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 10 && hour < 22; // Open 10 AM to 10 PM
};

const formatTime = (value: number): string => String(value).padStart(2, "0");

const calculateTimeLeft = (): number => {
  const now = new Date();
  const targetDate = new Date(
    now.getTime() +
      7 * 24 * 60 * 60 * 1000 +
      9 * 60 * 60 * 1000 +
      5 * 60 * 1000 +
      39 * 1000
  );
  return targetDate.getTime();
};

const Popular = () => {
  const { addToCart, cartItems } = useCart();

  const [targetTime, setTargetTime] = useState<number>(calculateTimeLeft());
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsSmallScreen(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetTime - now;

      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setTargetTime(calculateTimeLeft());
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTime]);

  const displayedItems = isSmallScreen ? foodItems.slice(0, 2) : foodItems;

  const handleAddToCart = (item: FoodItem) => {
    if (!isKitchenOpen()) {
      toast.error(`Kitchen is closed! Cannot add ${item.title}`, { position: "top-center", autoClose: 2000 });
      return;
    }

    const toastOptions = {
      position: "top-center" as const,
      autoClose: 2000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    };

    const itemId = String(item.id);
    const alreadyInCart = cartItems.some((cartItem) => cartItem.id === itemId);

    if (alreadyInCart) {
      toast.warning(`${item.title} is already in the cart!`, toastOptions);
      return;
    }

    addToCart({
      id: itemId,
      title: item.title,
      price: item.price,
      quantity: 1,
      imageUrl: item.image,
    });
    toast.success(`${item.title} added to cart!`, toastOptions);
  };

  return (
    <Container>
      <section
        aria-labelledby="popular-heading"
        className="px-4 md:px-8 3xl:px-14 2xl:px-4 xl:px-14 lg:px-0 mt-20 3xl:mb-52 2xl:mb-24 xl:mb-24 lg:mb-24 3xl:mt-52 2xl:mt-20 xl:mt-44 md:mt-40 overflow-hidden sm:-ml-24 md:-ml-16 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-0"
      >
        <Motion.div
          className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8"
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          <h1
            id="popular-heading"
            className="text-xl 3xl:text-4xl 2xl:text-4xl xl:text-3xl lg:text-2xl font-bold text-[#2C6252] mb-4 md:mb-0"
          >
            Our Most Popular Item
          </h1>
          <div
            className="flex items-center text-[#FF4C15] 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[10px] font-medium"
            aria-hidden="true"
          >
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            Authority suggested food list
          </div>
        </Motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-14">
          <Motion.article
            className="relative overflow-hidden flex flex-col justify-end aspect-[3/4] 3xl:min-h-[48rem] 2xl:min-h-[50rem] xl:min-h-[50rem] lg:min-h-[50rem] md:min-h-[40rem] min-h-[40rem] w-full"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            viewport={{ once: true }}
          >
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1752122434/order5_fvpldv.webp"
              alt="Weekly best sales products"
              className="absolute inset-0 w-full h-full object-cover z-0"
            />
            <div className="absolute inset-0 bg-black/40 z-10" aria-hidden="true"></div>
            <div className="relative z-20 text-white bg-[#FF4C15] 3xl:p-10 2xl:p-8 xl:p-8 lg:p-8 md:p-8 sm:p-6 3xl:bottom-36 2xl:bottom-44 xl:bottom-52 lg:bottom-52 md:bottom-52 sm:bottom-10 mx-6">
              <span className="inline-block text-white 3xl:text-xl 2xl:text-xl xl:text-xl lg:text-xl md:text-xl sm:text-lg font-semibold px-3 py-1 mb-3 -ml-3">
                Only online order
              </span>
              <h2 className="text-lg 3xl:text-5xl 2xl:text-4xl xl:text-3xl lg:text-2xl md:text-2xl font-extrabold leading-tight mb-4 drop-shadow-lg">
                Weekly best sales products
              </h2>
              <div
                className="flex sm:flex-col 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row 3xl:space-x-3 2xl:space-x-3 xl:space-x-3 lg:space-x-1 mb-6"
                role="timer"
                aria-label="Countdown to deal end"
              >
                {["DAY", "HRS", "MIN", "SEC"].map((label, idx) => (
                  <Motion.div
                    key={label}
                    className="flex flex-col items-center justify-center bg-yellow-500 3xl:p-2 2xl:p-4 xl:p-6 lg:p-5 md:p-5 sm:p-4 3xl:w-16 3xl:h-16 2xl:w-14 2xl:h-14 xl:w-12 xl:h-12 lg:w-12 lg:h-12 sm:w-20 sm:h-16 flex-shrink-0"
                    initial={{ opacity: 0, x: -30, y: 30 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.6, delay: idx * 0.2, ease: "easeOut" }}
                  >
                    <span className="3xl:text-2xl 2xl:text-2xl xl:text-xl lg:text-lg sm:text-lg font-bold">
                      {formatTime([timeLeft.days, timeLeft.hours, timeLeft.minutes, timeLeft.seconds][idx])}
                    </span>
                    <span className="3xl:text-xs 2xl:text-xs xl:text-[10px] lg:text-[8px] sm:text-sm">
                      {label}
                    </span>
                  </Motion.div>
                ))}
              </div>
              <div className="relative inline-block group">
                <Link
                  href={isKitchenOpen() ? "/menu" : "#"}
                  aria-label={isKitchenOpen() ? "Order Classic Roast Brew now" : "Unavailable"}
                >
                  <Motion.button
                    className={`px-6 py-3 font-bold 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-sm md:text-sm sm:text-xs whitespace-nowrap ${
                      isKitchenOpen()
                        ? "bg-[#2C6252] text-white cursor-pointer hover:bg-[#1F4B3C]"
                        : "bg-gray-400 text-gray-200 cursor-not-allowed"
                    }`}
                    whileHover={isKitchenOpen() ? { scale: 1.05 } : {}}
                    whileTap={isKitchenOpen() ? { scale: 0.95 } : {}}
                    disabled={!isKitchenOpen()}
                  >
                    {isKitchenOpen() ? "Order Now" : "Unavailable"}
                  </Motion.button>
                </Link>

                {/* Tooltip for unavailable button */}
                {!isKitchenOpen() && (
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-black text-white text-xs rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    Kitchen will open at 10 AM
                  </div>
                )}
              </div>
            </div>
          </Motion.article>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 3xl:gap-6 2xl:gap-6 xl:gap-4 lg:gap-4 md:gap-4 sm:gap-4">
            {displayedItems.map((item, index) => (
              <Motion.article
                key={item.id}
                className="bg-[#F8F8F8] p-4 flex flex-col"
                initial="hidden"
                animate="visible"
                custom={index}
                variants={fadeInUp}
              >
                <figure className="w-full h-52 overflow-hidden">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                </figure>
                <div className="flex flex-col flex-grow mt-6">
                  <h3 className="3xl:text-xl 2xl:text-xl xl:text-xl lg:text-lg font-semibold text-[#2C6252] mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#CCCCCC] mb-4">{item.description}</p>
                  <div className="flex justify-between items-center mt-auto">
                    <span className="3xl:text-2xl 2xl:text-2xl xl:text-2xl lg:text-xl font-bold text-[#2C6252]">
                      ${item.price}
                      <span className="3xl:text-lg 2xl:text-lg xl:text-lg lg:text-sm text-[#B9B9B9] ml-1 font-semibold">
                        / pcs
                      </span>
                    </span>
                    <div className="relative inline-block group">
                      {isKitchenOpen() ? (
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="bg-[#2C6252] text-white p-2"
                          aria-label={`Add ${item.title} to cart`}
                        >
                          <img src="/Path 2764.svg" alt="Add to cart" />
                        </button>
                      ) : (
                        <button
                          className="bg-gray-400 text-white p-2 cursor-not-allowed flex items-center justify-center"
                          disabled
                          aria-label={`Kitchen is closed, cannot add ${item.title} to cart`}
                        >
                          <BsCartX size={20} />
                        </button>
                      )}

                      {/* Tooltip for unavailable cart button */}
                      {!isKitchenOpen() && (
                        <div className="absolute top-1/2 right-full mr-2 px-3 py-1 bg-black text-white text-xs rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap -translate-y-1/2">
                          Kitchen will open at 10 AM
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Motion.article>
            ))}
          </div>
        </div>
      </section>
    </Container>
  );
};

export default Popular;