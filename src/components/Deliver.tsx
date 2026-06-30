"use client";

import Link from "next/link";
import Container from "@/components/Container";
import { motion as Motion } from "framer-motion";
import { useState, useEffect } from "react";

interface TextVariant {
  opacity: number;
  y: number;
  transition?: { delay: number; duration: number; ease: string };
}

const textVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number): TextVariant => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: "easeOut" },
  }),
};

// Same restaurant timezone logic as TopBar/Signature — keep in sync if you change one
const KITCHEN_OPEN_HOUR = 10;
const KITCHEN_CLOSE_HOUR = 22;

const Deliver = () => {
  const [isKitchenOpen, setIsKitchenOpen] = useState<boolean>(true);

  // Check kitchen availability (10:00 - 22:00)
  useEffect(() => {
    const checkKitchenStatus = () => {
      const now = new Date();
      const hours = now.getHours();
      setIsKitchenOpen(hours >= KITCHEN_OPEN_HOUR && hours < KITCHEN_CLOSE_HOUR);
    };
    checkKitchenStatus();
    const interval = setInterval(checkKitchenStatus, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <Container>
      <section
        className="relative bg-white px-8 mt-32 mb-36 sm:-mt-52 sm:mb-20 3xl:-mt-12 3xl:mb-44 2xl:mt-14 2xl:mb-44 xl:mt-14 xl:mb-44 lg:-mt-24 lg:mb-44 md:-mt-24 md:mb-36 sm:-ml-20 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-0 md:-ml-0"
        aria-label="Delivery information section"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-8">
          {/* Left Animated Text Content */}
          <Motion.div
            className="3xl:space-y-6 2xl:space-y-3 xl:space-y-4 lg:space-y-2 md:space-y-2 sm:space-y-2 3xl:ml-8 2xl:-ml-2 xl:ml-5 lg:-ml-6 md:-ml-6 sm:-ml-6 sm:text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <Motion.h2
              className="sm:text-2xl 3xl:text-6xl 2xl:text-5xl xl:text-4xl lg:text-2xl md:text-2xl text-[#2C6252] flex flex-col sm:items-center 3xl:items-start 2xl:items-start xl:items-start lg:items-start md:items-center"
              custom={0}
              variants={textVariants}
              tabIndex={0}
            >
              <span className="3xl:mb-3 2xl:mb-3 xl:mb-3 lg:mb-0 md:mb-1">We Deliver</span>
              <span className="3xl:mb-3 2xl:mb-3 xl:mb-3 lg:mb-0 md:mb-1">Food Within</span>
              <span className="text-[#FF4C15] 3xl:mb-3 2xl:mb-2 xl:mb-2 lg:mb-3 md:mb-4">30 Min ⏰</span>
            </Motion.h2>

            <Motion.p
              className="text-[#CCCCCC] max-w-md sm:text-xs 3xl:text-base 2xl:text-sm xl:text-sm lg:text-xs md:text-xs sm:mx-auto lg:mx-0 lg:text-left"
              custom={1}
              variants={textVariants}
              tabIndex={0}
            >
              When I research companies online, I don&apos;t just want to hear the company&apos;s pitch; I want to hear from its customers...
            </Motion.p>

            <Motion.div
              className="flex flex-wrap gap-4 mt-10 sm:pt-3 md:pt-4 3xl:pt-5 2xl:pt-6 xl:pt-5 lg:pt-7 sm:justify-center lg:justify-start md:justify-center"
              custom={2}
              variants={textVariants}
            >
              <div className="relative inline-block group">
                <Link
                  href={isKitchenOpen ? "/order" : "#"}
                  aria-label={isKitchenOpen ? "Order Now" : "Unavailable"}
                >
                  <Motion.button
                    whileHover={isKitchenOpen ? { scale: 1.05 } : {}}
                    disabled={!isKitchenOpen}
                    className={`flex items-center justify-center relative 3xl:px-6 3xl:py-3 2xl:px-6 2xl:py-3 xl:px-4 xl:py-2 lg:px-3 lg:py-1 md:px-3 md:py-1 sm:px-2 sm:py-1 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[10px] ${
                      isKitchenOpen
                        ? "bg-[#FF4C15] text-white cursor-pointer"
                        : "bg-gray-400 text-gray-200 cursor-not-allowed"
                    }`}
                    type="button"
                  >
                    {isKitchenOpen && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src="/order.svg"
                        alt="Order Icon"
                        className="w-4 h-4 mr-2"
                        loading="lazy"
                      />
                    )}
                    {isKitchenOpen ? "Order Now" : "Unavailable"}
                  </Motion.button>
                </Link>

                {!isKitchenOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 px-2 py-1 bg-black text-white text-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    Kitchen will open at {KITCHEN_OPEN_HOUR} AM
                  </div>
                )}
              </div>

              <div className="hidden sm:inline-block lg:inline-block">
                <Motion.button
                  whileHover={{ scale: 1.05 }}
                  className="border border-[#707070] text-[#FF4C15] hover:bg-orange-50 3xl:px-6 3xl:py-3 2xl:px-6 2xl:py-3 xl:px-4 xl:py-2 lg:px-3 lg:py-1 sm:px-1 sm:py-1 md:px-3 md:py-1 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[10px] flex items-center"
                  type="button"
                  aria-label="Download Apps"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/download.svg" alt="Download Icon" className="w-4 h-4 mr-2" loading="lazy" />
                  Download Apps
                </Motion.button>
              </div>
            </Motion.div>
          </Motion.div>

          {/* Right Image with Float Animation */}
          <div
            className="flex justify-center lg:justify-end relative sm:-ml-10 sm:-mr-3 3xl:-mr-0 2xl:-mr-0 xl:-mr-0 lg:-mr-0 md:-mr-0 3xl:-ml-4 2xl:-ml-4 xl:-ml-4 md:-ml-12 sm:mt-6 3xl:mt-0 2xl:mt-0 xl:mt-0 lg:mt-0 md:mt-0"
            style={{
              backgroundImage: `url('https://res.cloudinary.com/dxohwanal/image/upload/v1747286119/Group_532_yxgunv.png')`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "contain",
              backgroundPosition: "center",
            }}
            aria-hidden="true"
          >
            <Motion.div
              className="max-w-sm lg:max-w-full"
              initial={{ y: 0 }}
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://res.cloudinary.com/dxohwanal/image/upload/v1752053930/deliver1_a5xpyd.webp"
                alt="Delivery Guy"
                className="object-contain w-full 3xl:-ml-32 3xl:-mt-16 2xl:-ml-32 2xl:-mt-16 xl:-ml-32 xl:-mt-16 lg:-ml-32 lg:-mt-16 sm:-ml-10 sm:-mt-6"
                loading="lazy"
              />
            </Motion.div>
          </div>
        </div>
      </section>
    </Container>
  );
};

export default Deliver;