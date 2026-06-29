"use client";

import Link from "next/link";
import Container from "@/components/Container";
import { motion as Motion } from "framer-motion";
import { useState, useEffect } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

const foodItems = [
  {
    id: 1,
    img: "https://res.cloudinary.com/dxohwanal/image/upload/v1752051031/buffet1_ek10ch.webp",
    alt: "Grilled Lamb Chops",
    ratingFull: 4,
    ratingHalf: true,
    ratingValue: "4.5 Rating",
    title: "Grilled Lamb Chop",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection with fresh greens.",
  },
  {
    id: 2,
    img: "https://res.cloudinary.com/dxohwanal/image/upload/v1752051223/buffet2_lv0gz5.webp",
    alt: "Grilled Super Steak",
    ratingFull: 5,
    ratingHalf: false,
    ratingValue: "5.0 Rating",
    title: "Grilled Super Steak",
    description:
      "Tender and juicy steak grilled to your liking, served with your choice side.",
  },
  {
    id: 3,
    img: "https://res.cloudinary.com/dxohwanal/image/upload/v1752051401/buffet3_brkpjm.webp",
    alt: "Pan-Seared Steak",
    ratingFull: 4,
    ratingHalf: false,
    ratingValue: "4.0 Rating",
    title: "Pan-Seared Steak",
    description:
      "Succulent, spice-rubbed lamb chops grilled to perfection with fresh greens.",
  },
  {
    id: 4,
    img: "https://res.cloudinary.com/dxohwanal/image/upload/v1752051554/buffet4_cwwunl.webp",
    alt: "Special Sandwich",
    ratingFull: 5,
    ratingHalf: false,
    ratingValue: "5.0 Rating",
    title: "Special Sandwich",
    description:
      "Delicious vegetarian pasta with fresh vegetables and a flavorful sauce.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const fadeUpVariant = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ease: "easeOut" as const, duration: 0.7 },
  },
};

const buttonHover = {
  scale: 1.05,
  boxShadow: "0 8px 15px rgba(255, 76, 21, 0.6)",
  transition: { duration: 0.3 },
};

const cardHover = {
  scale: 1.06,
  boxShadow: "0 20px 40px rgba(255, 255, 255, 0.3)",
  transition: { duration: 0.4 },
};

const Buffet = () => {
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  return (
    <Container>
      <section className="mb-36 3xl:mt-64 2xl:mt-56 xl:mt-40 lg:mt-40 md:mt-40 sm:mt-28 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-3 md:-ml-10 sm:-ml-[7.5rem]">
        <div className="px-4 sm:px-6 3xl:px-8 2xl:px-8 xl:px-8 lg:px-2 md:px-2">
          {/* Header */}
          <Motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUpVariant}
            className="relative bg-[url('https://res.cloudinary.com/dxohwanal/image/upload/v1752039838/Buffet_z0iumv.png')] bg-no-repeat bg-contain bg-center h-[20rem] flex flex-col items-center justify-center -mt-[22rem]"
          >
            <span className="bg-[#FF4C15] text-white py-1 px-5 flex items-center justify-center transform -rotate-[5deg] w-fit mx-auto relative mt-[2rem] shadow-lg drop-shadow-md rounded-full">
              <div className="bg-white w-6 h-6 flex items-center justify-center mr-3 rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/svg.png" className="w-4 h-4 rounded-full" alt="Category Icon" />
              </div>
              <span className="text-xs font-semibold tracking-wider uppercase rounded-full">
                Delicious <span className="font-thin lowercase">(Food)</span>
              </span>
            </span>
            <h2 className="3xl:text-5xl 2xl:text-5xl xl:text-4xl lg:text-3xl md:text-3xl sm:text-lg font-semibold text-[#2C6252] relative mt-10 text-center drop-shadow-md">
              Buffet for Signature Food
            </h2>
          </Motion.div>

          {/* Food Cards */}
          <Motion.div
            className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12 3xl:mt-4 2xl:mt-2 xl:mt-0 lg:-mt-6 md:-mt-6 sm:-mt-12"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            {(isSmallScreen && !showAll ? foodItems.slice(0, 2) : foodItems).map(
              (
                { id, img, alt, ratingFull, ratingHalf, ratingValue, title, description },
                idx
              ) => (
                <Motion.div
                  key={id}
                  variants={fadeUpVariant}
                  transition={{ delay: idx * 0.15 }}
                  whileHover={cardHover}
                  className="overflow-hidden relative cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={alt}
                    className="w-full 3xl:h-52 2xl:h-52 xl:h-52 lg:h-52 md:h-52 sm:h-44 object-cover mb-3"
                  />
                  <span className="absolute top-2 right-2 bg-gradient-to-r from-[#FFCA46] to-[#FFD966] text-xs px-2 py-1 text-[#F6F6F6] font-semibold flex items-center backdrop-blur-sm bg-opacity-80">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/svg.svg" className="w-4 h-4 mr-1" alt="Available Food Icon" />
                    Food Available
                  </span>
                  <div className="p-5">
                    <div className="flex items-center mb-3">
                      {[...Array(ratingFull)].map((_, i) => (
                        <svg
                          key={i}
                          className="w-5 h-5 text-yellow-400 mr-1 drop-shadow"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 3.635 1.123 6.545z" />
                        </svg>
                      ))}
                      {ratingHalf && (
                        <svg
                          className="w-5 h-5 text-yellow-400 mr-1 drop-shadow"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <defs>
                            <clipPath id={`half-star-${id}`}>
                              <rect x="0" y="0" width="10" height="20" />
                            </clipPath>
                          </defs>
                          <path
                            d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 3.635 1.123 6.545z"
                            clipPath={`url(#half-star-${id})`}
                          />
                        </svg>
                      )}
                      <span className="text-[#777777] font-semibold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-[10px] md:text-[10px] sm:text-[10px] ml-2 select-none whitespace-nowrap">
                        ({ratingValue})
                      </span>
                    </div>
                    <h3 className="3xl:text-xl 2xl:text-xl xl:text-lg lg:text-[14px] md:text-[14px] sm:text-[14px] font-bold text-[#2C6252] mb-4">
                      {title}
                    </h3>
                    <p className="text-[#666666] 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-[12px] md:text-[12px] sm:text-[12px] mb-5 leading-relaxed">
                      {description}
                    </p>
                    <Link href="/chefs">
                      <Motion.button
                        whileHover={buttonHover}
                        className="bg-gradient-to-r from-[#FF4C15] to-[#FF6A00] text-white 3xl:py-3 3xl:px-6 2xl:py-3 2xl:px-6 xl:py-3 xl:px-6 md:py-3 md:px-6 sm:py-2 sm:px-4 text-sm font-semibold transition-all duration-300 flex items-center justify-center w-full whitespace-nowrap"
                      >
                        Learn More
                        <svg
                          className="ml-2 w-5 h-5 text-white animate-bounce"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </Motion.button>
                    </Link>
                  </div>
                </Motion.div>
              )
            )}
          </Motion.div>

          {/* Dropdown Toggle Button for Small Screens */}
          {isSmallScreen && (
            <div className="sm:flex md:hidden mt-10 z-10 justify-center">
              <button
                onClick={() => setShowAll((prev) => !prev)}
                className="text-[#2C6252] flex flex-col items-center text-xl"
                aria-label={showAll ? "Show less items" : "Show more items"}
              >
                {showAll ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            </div>
          )}

          {/* Bottom Section */}
          <div className="flex flex-col md:flex-row items-stretch overflow-hidden 3xl:px-6 2xl:px-0 xl:px-1 lg:px-2 md:px-2 sm:px-2 2xl:-ml-5 3xl:-ml-0 xl:-ml-0 lg:-ml-1">
            <Motion.div
              className="flex flex-col justify-center px-6 py-10 w-full 2xl:w-1/3 3xl:w-1/3 xl:w-1/2 lg:w-1/2 md:w-1/2 sm:w-1/2 z-50"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUpVariant}
            >
              <h2 className="text-[#2C6252] 2xl:text-3xl 3xl:text-5xl xl:text-3xl lg:text-2xl md:text-2xl sm:text-2xl font-semibold tracking-wide drop-shadow-md 3xl:-ml-4 2xl:ml-1 xl:ml-1 lg:-ml-4 md:-ml-4 sm:ml-1 sm:hidden md:block lg:block xl:block 2xl:block 3xl:block">
                Deep <br /> Blue <br /> Delights
              </h2>

              <h2 className="text-[#2C6252] sm:-ml-7 font-semibold drop-shadow-md text-xl sm:block md:hidden">
                Deep Blue Delights
              </h2>
            </Motion.div>

            <div className="relative w-full 3xl:h-96 2xl:h-64 xl:h-60 lg:h-60 md:h-60 sm:h-44">
              <Motion.img
                src="https://res.cloudinary.com/dxohwanal/image/upload/v1752051794/buffet5_zp25b9.webp"
                alt="Deep Blue Delights Image"
                className="w-full h-full object-cover 3xl:-ml-1 2xl:ml-4 xl:ml-0 lg:ml-2 md:ml-2 sm:-ml-1"
                initial={{ opacity: 0, scale: 1.1 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
              />

              <div className="flex justify-between items-end h-full">
                <Motion.div
                  className="absolute 3xl:bottom-32 2xl:bottom-24 xl:bottom-20 lg:bottom-20 md:bottom-20 sm:bottom-0 3xl:left-4 2xl:left-6 xl:left-6 lg:left-10 md:left-10 sm:left-10 text-white p-4 text-sm max-w-[300px] z-20 sm:hidden md:block lg:block xl:block 2xl:block 3xl:block"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
                >
                  Succulent, spice-rubbed lamb chops grilled to perfection and served with fresh greens.
                </Motion.div>

                <Motion.img
                  className="absolute -bottom-16 left-96 w-full h-[32rem] z-20"
                  src="https://res.cloudinary.com/dxohwanal/image/upload/v1747034204/Buffet_qtw3le.png"
                  alt="Buffet Overlay Image"
                  initial={{ x: 0 }}
                  animate={{ x: [0, 15, 0] }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Container>
  );
};

export default Buffet;