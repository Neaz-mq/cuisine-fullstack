"use client";

import { useState, useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import Link from "next/link";
import { motion as Motion } from "framer-motion";

const Banner = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    AOS.init({ once: true });
  }, []);

  return (
    <div className="flex items-center justify-center overflow-hidden z-20 3xl:-mt-10 md:-ml-16 sm:-ml-36 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-0">
      <section className="relative bg-white" aria-label="Promotional Banner">
        <div className="flex items-start justify-between sm:w-56 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full">
          <Motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="relative 3xl:p-8 2xl:p-8 xl:p-8 lg:p-0 md:p-0 3xl:top-4 2xl:top-4 xl:top-4 lg:top-8 md:top-3 3xl:left-2 2xl:-left-12 xl:-left-6 lg:-left-8 md:-left-12 sm:-left-12"
          >
            <img
              className="absolute 3xl:left-[-20px] 3xl:right-10 3xl:-top-10 2xl:left-[-20px] 2xl:right-10 2xl:-top-10 xl:left-[-20px] xl:right-10 xl:-top-10 lg:left-[-36px] lg:right-16 lg:-top-16 md:left-[-36px] md:right-16 md:-top-16 opacity-60 blur-sm md:hidden sm:hidden 3xl:block 2xl:block xl:block lg:block"
              src="/Ellipse 9.svg"
              alt="Background Ellipse"
              aria-hidden="true"
              loading="lazy"
            />

            <div className="3xl:ml-4 2xl:ml-4 xl:ml-4 lg:ml-4 md:ml-16 sm:ml-16">
              <div className="md:block sm:block 3xl:hidden 2xl:hidden xl:hidden lg:hidden md:-ml-2 sm:-ml-2 sm:w-36 md:w-full">
                <Link href="/offer" aria-label="Go to offers page">
                  <button
                    className="bg-[#2C6252] text-white md:px-3 sm:px-2 md:py-1 sm:py-0 rounded-full flex items-center md:space-x-4 sm:space-x-1 border-2 border-orange-500 transition-transform duration-300 hover:scale-105 3xl:text-[20px] 2xl:text-[16px] xl:text-[13px] lg:text-[12px] md:text-[12px] sm:text-[10px]"
                    type="button"
                  >
                    <span>Up to 50% Off</span>
                    <div className="bg-white md:p-2 sm:p-1 rounded-full flex items-center justify-center">
                      <img src="/arrow.svg" alt="Arrow Right" className="h-3 w-3" />
                    </div>
                  </button>
                </Link>
              </div>

              <Motion.h1
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                className="3xl:text-6xl 2xl:text-4xl xl:text-3xl lg:text-2xl md:text-2xl font-bold text-[#2C6252] leading-tight flex items-center 3xl:-mt-3 2xl:-mt-3 xl:-mt-3 lg:-mt-3 md:mt-3 sm:mt-3 sm:w-36 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full"
              >
                Savor the
                <div className="md:hidden sm:hidden 3xl:block 2xl:block xl:block lg:block">
                  <button
                    className="bg-white text-black py-1 3xl:px-3 2xl:px-3 xl:px-3 lg:px-2 md:px-2 sm:px-2 rounded-full flex items-center space-x-2 ml-8 text-sm border border-black transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FF4C15]"
                    onClick={() => setIsModalOpen(true)}
                    aria-label="Watch Live Kitchen"
                    type="button"
                  >
                    <span className="flex items-center 3xl:text-[20px] 2xl:text-[17px] xl:text-[15px] lg:text-[14px] md:text-[14px]">
                      <span className="text-red-500 ml-2 mr-1">Live</span>
                      <span className="text-[#2C6252]">kitchen</span>
                    </span>
                    <div className="bg-[#FF4C15] rounded-full p-2 ml-2 3xl:w-8 2xl:w-8 xl:w-8 lg:w-6 md:w-6 sm:w-6 3xl:h-8 2xl:h-8 xl:h-8 lg:h-6 md:h-6 sm:h-6 flex items-center justify-center">
                      <img src="/Polygon 2.svg" alt="Play icon" className="h-2 w-5" />
                    </div>
                  </button>
                </div>
              </Motion.h1>

              <Motion.h2
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                className="3xl:text-6xl 2xl:text-4xl xl:text-3xl lg:text-2xl md:text-2xl font-bold text-[#2C6252] leading-tight 3xl:mt-3 2xl:mt-2 xl:mt-2 lg:mt-1 md:mt-1 sm:mt-1"
              >
                Flavor, Relish
              </Motion.h2>
            </div>

            <Motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="flex items-center space-x-4 ml-4 3xl:mt-3 2xl:mt-2 xl:mt-2 lg:mt-1 md:mt-1 sm:mt-1"
            >
              <span className="text-[#FF4C15] 3xl:text-6xl 2xl:text-4xl xl:text-2xl lg:text-2xl md:text-2xl font-bold md:ml-12 sm:ml-12 3xl:ml-0 2xl:ml-0 xl:ml-0 lg:ml-0">
                Every Bite!
              </span>
              <div className="md:hidden sm:hidden 3xl:block 2xl:block xl:block lg:block">
                <Link href="/offer" aria-label="Go to offers page">
                  <button
                    className="bg-[#2C6252] text-white 3xl:py-2 2xl:py-2 xl:py-2 lg:py-1 3xl:px-3 2xl:px-3 xl:px-3 lg:px-2 md:px-2 sm:px-2 rounded-full flex items-center space-x-2 border-2 border-orange-500 transition-transform duration-300 hover:scale-105 3xl:text-[20px] 2xl:text-[16px] xl:text-[13px] lg:text-[12px] md:text-[12px] sm:text-[12px]"
                    type="button"
                  >
                    <span>Up to 50% Off</span>
                    <div className="bg-white p-2 rounded-full flex items-center justify-center">
                      <img src="/arrow.svg" alt="Arrow Right" className="h-3 w-3" />
                    </div>
                  </button>
                </Link>
              </div>
            </Motion.div>

            <Motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="3xl:-mt-6 2xl:-mt-6 xl:-mt-6 lg:-mt-6 md:-mt-16 sm:-mt-16"
            >
              <p
                className="mb-8 3xl:text-[20px] 2xl:text-[16px] xl:text-[12px] lg:text-[9px] md:text-[9px] sm:text-[8px] 3xl:ml-2 2xl:ml-2 xl:ml-2 lg:ml-2 md:ml-10 sm:ml-9 p-4 bg-cover bg-center 3xl:w-[650px] 2xl:w-[500px] xl:w-[480px] lg:w-[480px] md:w-[400px] sm:w-[100px] 3xl:h-[250px] 2xl:h-[220px] xl:h-[180px] lg:h-[150px] md:h-[200px] sm:h-[100px] flex flex-col justify-center sm:mt-10"
                style={{
                  backgroundImage:
                    "url('https://res.cloudinary.com/dxohwanal/image/upload/v1742627149/Tasty_uw9ilh.png')",
                }}
              >
                <span className="inline-flex">
                  <span className="text-[#FF4C15] whitespace-nowrap md:ml-3 sm:ml-3 3xl:ml-0 2xl:ml-0 xl:ml-0 lg:ml-0 md:block sm:hidden 3xl:block 2xl:block xl:block lg:block">
                    Experience the perfect blend of taste and joy—
                  </span>
                  <span className="text-[#FF4C15] whitespace-nowrap md:ml-3 sm:ml-3 3xl:ml-0 2xl:ml-0 xl:ml-0 lg:ml-0 md:hidden sm:block 3xl:hidden 2xl:hidden xl:hidden lg:hidden">
                    Experience the perfect blend of taste and joy
                  </span>
                  <span className="text-[#AAAAAA] ml-2 whitespace-nowrap md:block sm:hidden 3xl:block 2xl:block xl:block lg:block">
                    every bite is a
                  </span>
                  <span className="text-[#AAAAAA] ml-2 whitespace-nowrap md:block sm:hidden 3xl:hidden 2xl:hidden xl:hidden lg:hidden">
                    every bite is a
                  </span>
                </span>

                <span className="text-[#AAAAAA] md:hidden sm:hidden 3xl:block 2xl:block xl:block lg:block mt-2">
                  moment of delight, crafted to satisfy your cravings!
                </span>
                <span className="text-[#AAAAAA] md:block sm:hidden 3xl:hidden 2xl:hidden xl:hidden lg:hidden mt-2 md:ml-3 sm:ml-3 3xl:ml-0 2xl:ml-0 xl:ml-0 lg:ml-0">
                  moment of delight
                </span>
              </p>
            </Motion.div>

            <div className="flex items-center 3xl:space-x-20 2xl:space-x-20 xl:space-x-20 lg:space-x-10 md:space-x-10 sm:space-x-6 3xl:-mt-20 2xl:-mt-20 xl:-mt-20 lg:-mt-20 md:-mt-28 sm:-mt-14 3xl:ml-5 2xl:ml-5 xl:ml-5 lg:ml-5 md:ml-14 sm:ml-14 sm:w-60 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full">
              {[
                {
                  src: "https://res.cloudinary.com/dxohwanal/image/upload/v1752050418/banner2_wtpney.webp",
                  price: "20$",
                  extraClass:
                    "3xl:mt-[10px] 2xl:mt-[10px] xl:mt-[10px] lg:mt-[0px] md:mt-[00px] sm:mt-0",
                  priceTopClass:
                    "3xl:top-[60px] 2xl:top-[60px] xl:top-[60px] lg:top-[40px] md:top-[60px] sm:top-[30px]",
                },
                {
                  src: "https://res.cloudinary.com/dxohwanal/image/upload/v1752050599/banner3_yocvwl.webp",
                  price: "10$",
                  extraClass: "3xl:-mt-16 2xl:-mt-16 xl:-mt-16 lg:-mt-16 md:-mt-16 sm:-mt-8",
                  priceTopClass: "top-[20px]",
                },
              ].map((item, i) => (
                <Motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.3, duration: 0.8 }}
                  className="relative"
                >
                  <img
                    src={item.src}
                    alt={`Dish ${i + 1}`}
                    className={`3xl:w-auto 2xl:w-auto xl:w-auto lg:w-40 md:w-40 ${item.extraClass || ""}`}
                    loading="lazy"
                  />
                  <div className={`absolute right-[-20px]  ${item.priceTopClass}`}>
                    <Motion.img
                      src="/flowershape.svg"
                      alt="Price Tag"
                      className="w-16"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    />
                    <span className="absolute top-[32px] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white font-bold text-xs">
                      {item.price}
                    </span>
                  </div>
                </Motion.div>
              ))}
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="relative 3xl:-mt-28 3xl:-ml-20 2xl:-ml-32 w-full 2xl:-mt-28 xl:-mt-20 xl:-ml-28 lg:-mt-[4.5rem] md:-mt-[5.4rem] lg:-ml-44 md:-ml-44 sm:-ml-52 sm:-mr-20 3xl:-mr-0 2xl:-mr-0 xl:-mr-0 lg:-mr-0 md:-mr-0 object-cover z-20 sm:w-full sm:-mt-8 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full"
          >
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1752045017/banner1_p7xkxk.webp"
              alt="Delicious Dish"
              className="3xl:w-full 2xl:w-full xl:w-[44rem] lg:w-[32rem] md:w-[32rem] 3xl:-ml-24 2xl:-ml-10 xl:-ml-16 lg:-ml-0 md:ml-32 sm:ml-24 3xl:h-[50rem] 2xl:h-[44rem] xl:h-[38rem] lg:h-[30rem] md:h-[34rem] object-cover sm:w-full sm:h-[13rem]"
              loading="lazy"
            />
          </Motion.div>
        </div>

        {isModalOpen && (
          <div
            className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white p-4 rounded-lg relative max-w-[90vw] max-h-[80vh] overflow-auto">
              <button
                className="absolute top-2 right-2 text-white rounded-full p-2 bg-[#FF4C15] transition duration-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FF4C15]"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  className="w-6 h-6"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <iframe
                width="560"
                height="315"
                src="https://www.youtube.com/embed/LVI8veUnSLQ"
                title="Live Kitchen YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Banner;