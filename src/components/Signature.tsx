"use client";

import { useRef, useState, useEffect } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import Container from "@/components/Container";
import { toast } from "react-toastify";
import { useCart } from "@/context/CartContext";
import { motion as Motion } from "framer-motion";

const foodItems = [
  {
    id: "classic-combo",
    title: "Classic Combo",
    price: 7.89,
    cuisine: "Chinese",
    tags: ["Chicken Burger", "French Fries", "Soft Drinks"],
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052166/signature1_gyjebg.webp",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    available: true,
  },
  {
    id: "chicken-delight",
    title: "Chicken Delight",
    price: 8.99,
    cuisine: "Chinese",
    tags: ["Crispy Chicken Sandwich", "French Fries", "Soft Drinks"],
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052270/signature2_wasgom.webp",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    available: true,
  },
  {
    id: "family-feast",
    title: "Family Feast",
    price: 19.89,
    cuisine: "Chinese",
    tags: ["Multiple dishes", "Large portions", "Soft Drinks"],
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052450/signature3_td2pb9.webp",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    available: true,
  },
  {
    id: "mega-meal",
    title: "Mega Meal",
    price: 29.99,
    cuisine: "Chinese",
    tags: ["Party Platter", "Extra Large", "Drinks Included"],
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752052734/signature4_ec4hsr.webp",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.",
    available: true,
  },
];

// Same restaurant timezone logic as TopBar — keep in sync if you change one
const RESTAURANT_TIMEZONE = "Asia/Dhaka";
const KITCHEN_OPEN_HOUR = 10;
const KITCHEN_CLOSE_HOUR = 22;

const Signature = () => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const { addToCart } = useCart();
  const [isKitchenOpen, setIsKitchenOpen] = useState(true);

  useEffect(() => {
    const checkKitchenStatus = () => {
      const now = new Date();
      const hourInRestaurantTz = parseInt(
        new Intl.DateTimeFormat("en-US", {
          timeZone: RESTAURANT_TIMEZONE,
          hour: "numeric",
          hourCycle: "h23",
        }).format(now),
        10
      );
      setIsKitchenOpen(
        hourInRestaurantTz >= KITCHEN_OPEN_HOUR &&
          hourInRestaurantTz < KITCHEN_CLOSE_HOUR
      );
    };

    checkKitchenStatus();
    const interval = setInterval(checkKitchenStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const scroll = (direction: "left" | "right") => {
    const carousel = carouselRef.current;
    if (carousel) {
      const card = carousel.querySelector("div");
      const cardWidth = card?.clientWidth || 0;
      const scrollAmount = direction === "left" ? -cardWidth - 48 : cardWidth + 48;
      carousel.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <Container>
      <section
        className="3xl:bg-[#2C6252] 2xl:bg-[#2C6252] xl:bg-[#2C6252] lg:bg-[#2C6252] md:bg-[#2C6252] sm:bg-white text-white py-24 relative mb-72 3xl:w-[75rem] 2xl:w-[62rem] xl:w-[54rem] lg:w-[42rem] md:w-[32rem] sm:w-[10rem] sm:mx-auto 3xl:ml-[4.3rem] 2xl:ml-4 xl:ml-12 lg:-ml-2 md:-ml-2 sm:-ml-[6.4rem] 3xl:mt-60 2xl:mt-52 xl:mt-48 lg:mt-44 md:mt-44 sm:-mt-28"
        aria-label="Chinese Food Set Meals Section"
      >
        <div className="mx-auto px-14 relative sm:left-0 left-6">
          {/* Rotated label */}
          <div className="absolute rotate-[-80deg] 3xl:top-[7rem] 2xl:top-[8rem] xl:top-[6rem] lg:top-[5rem] md:top-[5rem] sm:top-[5rem] sm:hidden md:block lg:block xl:block 2xl:block 3xl:block">
            <div
              className="bg-[#FF4C15] text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-2 shadow-md
              3xl:-ml-66 2xl:-ml-60 xl:-ml-56 lg:-ml-60 md:-ml-60 sm:-ml-72"
              aria-hidden="true"
            >
              <div className="bg-white rounded-full w-6 h-6 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/Group 811.svg" className="w-3.5 h-3.5" alt="Flag Icon" aria-hidden="true" loading="lazy" />
              </div>
              Foreign customer for (food menu)
            </div>
          </div>

          {/* Headline */}
          <h2
            className="font-semibold whitespace-nowrap sm:text-2xl sm:absolute sm:-top-24 sm:left-4 sm:rotate-0 sm:whitespace-normal md:rotate-[-90deg] md:absolute md:top-[14rem] md:-left-16 md:text-[30px] sm:text-[18px]
            lg:top-[14rem] lg:-left-16 lg:text-[30px] xl:top-[14rem] xl:-left-24 xl:text-[36px] 2xl:top-[14rem] 2xl:-left-24 2xl:text-[36px] 3xl:top-[14.5rem] 3xl:-left-32 3xl:text-[40px] 3xl:text-white 2xl:text-white xl:text-white lg:text-white md:text-white sm:text-[#2C6252]"
          >
            Chinese Food Set Meals
          </h2>

          {/* Carousel */}
          <div
            className="3xl:ml-[11.6rem] 2xl:ml-[7.5rem] xl:ml-[7.5rem] lg:ml-[8.5rem] md:ml-[6rem] sm:-ml-10 relative z-10 sm:mt-16"
            role="region"
            aria-label="Food Items Carousel"
          >
            <div
              ref={carouselRef}
              className="flex overflow-hidden scroll-smooth 3xl:gap-12 2xl:gap-8 xl:gap-4 lg:gap-14 md:gap-10 sm:gap-4
              3xl:w-[calc(20rem*3+3rem*2)] 2xl:w-[calc(17rem*3+3rem*2)] xl:w-[calc(14rem*3+3rem*2)] lg:w-[calc(11rem*3+3rem*2)]
              md:w-[calc(6rem*3+3rem*2)] sm:w-[calc(2.33rem*3+3rem*2)] mx-auto"
            >
              {foodItems.map((item) => (
                <Motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.03, rotate: 0.5 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="bg-white text-black 3xl:w-[20rem] 2xl:w-[19rem] xl:w-[17rem] lg:w-[17rem] md:w-[16rem]
                  sm:w-[15rem] flex-shrink-0 shadow-md hover:shadow-lg"
                  tabIndex={0}
                  aria-label={`${item.title} food item`}
                >
                  <div className="relative">
                    <Motion.img
                      src={item.image}
                      alt={`${item.title} Image`}
                      className="w-full 3xl:h-48 2xl:h-48 xl:h-48 lg:h-48 md:h-48 sm:h-32 object-cover"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      loading="lazy"
                    />
                    {item.available && (
                      <span
                        className="absolute top-2 right-2 bg-[#FFCA46] text-xs px-2 py-1 text-[#F6F6F6] font-medium flex items-center"
                        aria-label="Food Available"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/svg.svg" className="w-3 h-3 mr-1" alt="Available Icon" aria-hidden="true" loading="lazy" />
                        Food Available
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="text-[#2C6252] 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-lg md:text-lg sm:text-sm font-medium mt-2 ml-2">
                      {item.cuisine}
                    </h3>
                    <h2 className="font-semibold 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-lg md:text-lg sm:text-xs text-[#2C6252] ml-2 mt-1">
                      {item.title} - ${item.price.toFixed(2)}
                    </h2>

                    <ul className="text-[#AAAAAA] mt-6 list-none text-sm p-0" aria-label={`${item.title} tags`}>
                      {item.tags.map((tag, idx) => (
                        <li key={idx} className="flex items-center gap-2 mb-1 ml-2 ">
                          <div className="w-5 h-5 bg-green-500 rounded-sm flex items-center justify-center" aria-hidden="true">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="w-3.5 h-3.5 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-gray-400 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs">{tag}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="text-[#c2c2c2] 3xl:text-[12px] 2xl:text-[12px] xl:text-[12px] lg:text-[12px] md:text-[12px] sm:text-[9px] ml-2 mt-4 sm:w-36 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full">
                      {item.description}
                    </p>

                    <div className="relative inline-block group">
                      <Motion.button
                        disabled={!isKitchenOpen}
                        onClick={() => {
                          addToCart({
                            id: item.id,
                            title: item.title,
                            price: item.price,
                            quantity: 1,
                            imageUrl: item.image,
                          });
                          toast.success(`${item.title} added to cart successfully!`, {
                            position: "top-center",
                            autoClose: 2000,
                            hideProgressBar: true,
                          });
                        }}
                        className={`mt-2 py-1 px-3 md:py-2 ml-2 md:px-4 w-auto whitespace-nowrap border-none rounded-sm flex items-center justify-center
                   ${
                     isKitchenOpen
                       ? "bg-[#FF4C15] hover:bg-orange-600 text-white text-sm md:text-base cursor-pointer"
                       : "bg-gray-400 text-gray-200 text-base md:text-lg cursor-not-allowed font-semibold"
                   }`}
                        aria-label={`Order ${item.title}`}
                      >
                        {isKitchenOpen ? "Order Now" : "Unavailable"}
                      </Motion.button>

                      {!isKitchenOpen && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-center text-[10px] md:text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-sm">
                          Kitchen will open at {KITCHEN_OPEN_HOUR}:00 (restaurant time)
                        </div>
                      )}
                    </div>
                  </div>
                </Motion.article>
              ))}
            </div>

            {/* Navigation Arrows */}
            <nav className="absolute -bottom-14 left-0 w-full flex justify-start z-20 sm:ml-0" aria-label="Carousel navigation">
              <div className="flex gap-2">
                <button
                  onClick={() => scroll("left")}
                  aria-label="Scroll Left"
                  className="bg-white text-teal-900 p-2 shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FF4C15]"
                  type="button"
                >
                  <FaChevronLeft />
                </button>
                <button
                  onClick={() => scroll("right")}
                  aria-label="Scroll Right"
                  className="bg-white text-teal-900 p-2 shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FF4C15]"
                  type="button"
                >
                  <FaChevronRight />
                </button>
              </div>
            </nav>
          </div>
        </div>
      </section>
    </Container>
  );
};

export default Signature;