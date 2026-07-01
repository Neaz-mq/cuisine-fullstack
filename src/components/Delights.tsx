"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion as Motion } from "framer-motion";
import Container from "@/components/Container";

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" },
};

const Delights = () => {
  const [isKitchenOpen, setIsKitchenOpen] = useState(true);

  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hour = now.getHours();
      setIsKitchenOpen(hour >= 10 && hour < 22); // Kitchen open 10AM-10PM
    };

    checkTime(); // initial check
    const interval = setInterval(checkTime, 1000); // update every second

    return () => clearInterval(interval);
  }, []);

  return (
    <Container>
      <section
        aria-labelledby="delights-heading"
        className="grid grid-cols-1 3xl:grid-cols-2 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 3xl:gap-4 2xl:gap-0 3xl:px-10 2xl:px-0 xl:px-6 lg:px-12 md:px-6 sm:px-12 py-12 3xl:mt-20 2xl:mt-20 3xl:ml-1 2xl:-ml-1 xl:ml-3 3xl:mb-32 2xl:mb-36 xl:mb-8 lg:mb-28 lg:-ml-20 md:mb-28 md:-ml-20 sm:mb-6 sm:-ml-40 md:gap-6 md:-mt-6 sm:-mt-20"
      >
        {/* Top Left - Shrimp */}
        <Motion.article {...fadeInUp} className="flex flex-col bg-white overflow-hidden p-6">
          <h2 className="text-[#2C6252] text-lg font-semibold tracking-wide drop-shadow-md sm:block md:hidden lg:hidden xl:hidden 2xl:hidden 3xl:hidden">
            Deep Blue <br /> Delights
          </h2>

          <Motion.img
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1752055520/menu2_cvwcfg.webp"
            alt="Shrimp dish with fresh ingredients"
            className="w-full h-auto object-cover sm:mt-5 3xl:mt-0 2xl:mt-0 xl:mt-0 lg:mt-0 md:mt-0"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          />
          <div className="flex flex-col mt-16">
            <div className="sm:block md:hidden lg:hidden xl:hidden 2xl:hidden 3xl:hidden -mt-10">
              <div className="flex items-center space-x-1">
                <span className="text-[#FFE61C]" aria-hidden="true">★★★★★</span>
                <span className="text-[10px] text-[#CCCCCC] whitespace-nowrap">(4.8 Rating)</span>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <h2 id="delights-heading" className="3xl:text-2xl 2xl:text-2xl xl:text-2xl lg:text-2xl md:text-xl sm:text-sm font-medium text-[#2C6252] sm:mt-2 3xl:mt-0 2xl:mt-0 xl:mt-0 lg:mt-0 md:mt-0">
                Fresh and High- <span className="text-[#FF4C15]">Quality Ingredients</span>
              </h2>
              <div className="flex items-center space-x-1 sm:hidden md:block lg:block xl:block 2xl:block 3xl:block">
                <span className="text-[#FFE61C]" aria-hidden="true">★★★★★</span>
                <span className="text-xs text-[#CCCCCC]">(4.8 Rating)</span>
              </div>
            </div>
            <div className="flex sm:flex-col 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row items-center justify-between mt-6">
              <p className="text-xs text-[#AAAAAA] 3xl:w-2/3 2xl:w-2/3 xl:w-2/3 lg:w-2/3 pr-4">
                At Ocean's Bounty, every dish tells a story of the sea — fresh,
                vibrant, and full of life. We believe great seafood should taste like a
                seaside escape, where the salt air kisses your skin and every bite
                feels like a wave of pure flavor.
              </p>
              <div className="relative inline-block group">
                <Link
                  href={isKitchenOpen ? "/order" : "#"}
                  aria-label={isKitchenOpen ? "Order Fresh Seafood Now" : "Unavailable"}
                >
                  <button
                    disabled={!isKitchenOpen}
                    className={`px-3 py-2 3xl:text-lg 2xl:text-lg xl:text-lg md:text-lg font-semibold 3xl:-mt-4 2xl:-mt-4 xl:-mt-4 md:-mt-4 sm:mt-5 whitespace-nowrap 3xl:block 2xl:block xl:block lg:block md:hidden sm:block sm:text-sm ${isKitchenOpen
                        ? "bg-[#FF4C15] text-white hover:bg-orange-600 cursor-pointer"
                        : "bg-gray-400 text-gray-200 cursor-not-allowed"
                      }`}
                  >
                    {isKitchenOpen ? "Order Now" : "Unavailable"}
                  </button>
                </Link>

                {!isKitchenOpen && (
                  <div className="absolute -top-6 -left-16 px-3 py-1 bg-black text-white text-center text-[10px] sm:text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-sm whitespace-normal w-max max-w-[160px]">
                    Kitchen will open at 10 AM
                  </div>
                )}
              </div>
            </div>
          </div>
        </Motion.article>

        {/* Top Right - Sushi */}
        <Motion.div {...fadeInUp} className="flex justify-center items-center mt-5 w-full">
          <img
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1752056680/menu3_yskhz3.webp"
            alt="Assorted sushi served with traditional garnish"
            className="3xl:w-full 2xl:w-[32rem] xl:w-[29rem] sm:w-[29rem] 3xl:h-[700px] 2xl:h-[650px] xl:h-[640px] lg:h-[600px] md:h-[500px] sm:h-[150px] object-cover sm:ml-6"
          />
        </Motion.div>

        <div className="flex items-center space-x-1 text-base text-gray-500 mb-4 sm:block md:hidden lg:hidden xl:hidden 2xl:hidden 3xl:hidden ml-5 mt-4">
          <span className="text-yellow-500" aria-hidden="true">★★★★★</span>
          <span className="text-xs text-[#CCCCCC]">(4.8 Rating)</span>
        </div>
        <p className="3xl:text-sm 2xl:text-sm xl:text-sm md:text-xs sm:text-xs text-[#EFEFEF] mb-4 max-w-xs sm:block md:hidden lg:hidden xl:hidden 2xl:hidden 3xl:hidden ml-5 mt-4">
          Experience the perfect <br /> blend of taste and joy—every <br /> bite is a moment of <br /> delight, crafted <br /> to satisfy your cravings!
        </p>
        {/* Middle Banner - Chef Cooking */}
        <Motion.div
          {...fadeInUp}
          className="relative overflow-hidden w-full h-[350px] 3xl:h-[700px] 2xl:h-[680px] xl:h-[680px] lg:h-auto md:h-auto sm:h-auto 3xl:left-7 2xl:left-7 xl:left-6 lg:left-6 md:left-6 sm:left-6 3xl:-top-4 2xl:-top-0 sm:hidden md:block lg:block xl:block 2xl:block 3xl:block"
        >
          <img
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1752056828/menu4_kx7c9q.webp"
            alt="Chef preparing seafood dishes"
            className="absolute inset-0 3xl:w-[39.2rem] 2xl:w-[33.1rem] xl:w-[27.5rem] lg:w-[22rem] md:w-[22rem] sm:w-[42rem] h-auto object-cover object-center"
            loading="lazy"
            decoding="async"
          />
          <Motion.div
            initial={{ x: 300, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            viewport={{ once: true }}
            className="absolute top-0 3xl:right-12 2xl:right-12 3xl:w-[20rem] 2xl:w-[20rem] xl:w-[20rem] lg:w-[22rem] md:w-[22rem] sm:w-[22rem] h-72 bg-[#FF4B16] bg-opacity-80 text-white p-8 flex flex-col justify-center"
          >
            <h3 className="text-7xl font-bold leading-none mt-4">50%</h3>
            <p className="text-2xl font-semibold leading-tight mt-2">Discount Offer</p>
            <p className="mt-4 3xl:text-sm 2xl:text-sm xl:text-sm md:text-[10px] sm:text-xs leading-relaxed max-w-xs">
              We source only the freshest and highest-quality ingredients to ensure every
              dish bursts with flavor.
            </p>
          </Motion.div>
        </Motion.div>

        {/* Bottom Right - Deep Blue Delights */}
        <Motion.article
          {...fadeInUp}
          className="relative overflow-hidden w-full sm:h-[220px] md:h-[400px] lg:h-[485px] xl:h-[602px] 3xl:h-[700px] 2xl:h-[700px] bg-white p-6 flex 3xl:right-4 3xl:left-0 2xl:right-0 2xl:left-4"
        >
          {/* Left Content */}
          <div className="flex flex-col justify-end w-full lg:w-1/2 pr-4 z-10">
            <div className="flex items-center space-x-1 text-base text-gray-500 mb-4 sm:block md:hidden lg:hidden xl:hidden 2xl:hidden 3xl:hidden">
              <span
                className="text-yellow-500 sm:hidden md:block lg:block xl:block 2xl:block 3xl:block"
                aria-hidden="true"
              >
                ★★★★★
              </span>
              <span className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-xs sm:text-xs sm:hidden md:block lg:block xl:block 2xl:block 3xl:block text-[#CCCCCC]">
                (4.8 Rating)
              </span>
            </div>
            <p className="3xl:text-sm 2xl:text-sm xl:text-sm md:text-xs sm:text-xs text-[#EFEFEF] mb-4 max-w-xs sm:hidden md:block lg:block xl:block 2xl:block 3xl:block">
              Experience the perfect <br /> blend of taste and joy—every <br /> bite is a
              moment of <br /> delight, crafted <br /> to satisfy your cravings!
            </p>
            <div className="flex items-center space-x-1 text-base text-gray-500 mb-4 sm:hidden md:block lg:block xl:block 2xl:block 3xl:block">
              <span className="text-yellow-500" aria-hidden="true">★★★★★</span>
              <span className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-xs sm:text-xs text-[#CCCCCC]">
                (4.8 Rating)
              </span>
            </div>
            <div className="relative inline-block group">
              <Link
                href={isKitchenOpen ? "/order" : "#"}
                aria-label={isKitchenOpen ? "Order Deep Blue Delights Now" : "Unavailable"}
              >
                <Motion.button
                  whileHover={isKitchenOpen ? { scale: 1.05 } : {}}
                  disabled={!isKitchenOpen}
                  className={`flex items-center justify-center relative px-3 py-2 3xl:text-xl 2xl:text-xl xl:text-xl lg:text-xl md:text-sm sm:text-lg font-semibold w-full max-w-[150px] sm:hidden 3xl:block 2xl:block xl:block lg:block md:block ${isKitchenOpen
                      ? "bg-[#FF4C15] text-white cursor-pointer hover:bg-orange-600"
                      : "bg-gray-400 text-gray-200 cursor-not-allowed"
                    } rounded-sm`}
                  type="button"
                >
                  {isKitchenOpen ? "Order Now" : "Unavailable"}
                </Motion.button>
              </Link>

              {!isKitchenOpen && (
                <div className="absolute -top-10 left-0 px-3 py-1 bg-black text-white text-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-sm whitespace-normal w-max max-w-[160px]">
                  Kitchen will open at 10 AM
                </div>
              )}
            </div>
          </div>

          {/* Right Content */}
          <div className="flex flex-col items-center justify-center w-full lg:w-1/2 pl-4 z-10 text-left 3xl:-ml-24 2xl:-ml-32 xl:-ml-24 lg:-ml-20 md:-ml-28 sm:-ml-20">
            <h2 className="sm:text-2xl md:text-2xl lg:text-2xl 3xl:text-6xl 2xl:text-5xl xl:text-4xl font-bold 3xl:space-y-4 2xl:space-y-4 xl:space-y-2 lg:space-y-0 md:space-y-0 sm:space-y-0 3xl:-mt-[25rem] 2xl:-mt-[22rem] xl:-mt-[20rem] lg:-mt-[16rem] md:-mt-[16rem] sm:-mt-[16rem] sm:hidden md:block lg:block xl:block 2xl:block 3xl:block">
              <span className="text-[#2C6252]">Deep</span>
              <br />
              <span className="text-[#2C6252]">Blue</span>
              <br />
              <span className="text-[#FF4C15]">Delights</span>
            </h2>
            <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-xs md:text-[10px] sm:text-xs text-[#AAAAAA] mt-4 3xl:-ml-12 2xl:-ml-1 xl:ml-10 lg:ml-14 md:ml-10 sm:ml-14 whitespace-nowrap sm:hidden md:block lg:block xl:block 2xl:block 3xl:block">
              Savor the Secrets of the Sea
            </p>
          </div>

          {/* Rotating Image */}
          <Motion.img
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1752056997/menu5_ngludm.webp"
            alt="Grilled fish with herbs and spices"
            className="absolute bottom-0 right-0 3xl:left-60 2xl:left-60 xl:left-60 lg:left-48 md:left-32 sm:left-20 3xl:w-3/6 2xl:w-72 xl:w-3/6 lg:w-48 md:w-36 sm:w-40 h-auto object-contain z-0 3xl:top-[22rem] 2xl:top-96 xl:top-80 lg:top-[16.5rem] md:top-[11.5rem] sm:top-[2.5rem]"
            animate={{ rotate: 360 }}
            transition={{
              repeat: Infinity,
              duration: 10,
              ease: "linear",
            }}
            loading="lazy"
            decoding="async"
          />
        </Motion.article>
      </section>
    </Container>
  );
};

export default Delights;