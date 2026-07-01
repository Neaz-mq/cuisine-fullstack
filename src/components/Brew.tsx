"use client";

import Link from "next/link";
import Container from "@/components/Container";
import { motion as Motion } from "framer-motion";

const Brew = () => {
  return (
    <Container>
      <section
        className="3xl:px-16 2xl:px-6 xl:px-16 lg:px-2 3xl:mb-72 2xl:mb-72 xl:mb-[24rem] lg:mb-[22rem] md:mb-52 sm:mb-40 3xl:-mt-28 2xl:-mt-10 xl:mt-24 md:mt-36 sm:mt-28 md:-ml-24 sm:-ml-28 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-0"
        aria-labelledby="brew-heading"
      >
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative">
          {/* Left Section */}
          <div className="relative max-w-2xl w-full text-center lg:text-left">
            <div className="absolute top-0 -left-2 w-40 h-[22rem] bg-gray-100 opacity-60 hidden lg:block"></div>
            {/* Text Content */}
            <header className="relative z-10 px-4 lg:px-0">
              <Motion.h2
                id="brew-heading"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="3xl:text-[3rem] 2xl:text-[2.5rem] xl:text-[2.4rem] lg:text-[2.4rem] md:text-[2.4rem] sm:text-[1.5rem] font-bold"
              >
                <span className="text-[#2C6252] block leading-snug tracking-wide">
                  Classic
                </span>
                <span className="text-[#FF4C15] block mt-2 tracking-wide">
                  Roast Brew
                </span>
              </Motion.h2>
              <Motion.p
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                className="text-[#D7D7D7] 3xl:mt-10 2xl:mt-10 xl:mt-10 lg:mt-4 md:mt-5 sm:mt-4 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-[12px] sm:text-[9px] leading-relaxed absolute 3xl:left-72 2xl:left-72 xl:left-72 lg:left-72 md:left-20"
              >
                Enjoy unbeatable deals every week at Flavors & Feast! Whether
                you&apos;re craving a hearty meal, a sweet treat, or a refreshing coffee — our weekly offers have something for everyone.
              </Motion.p>
              <Link href="/carts" aria-label="Claim weekly offer for Roast Brew">
                <Motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  className="3xl:mt-40 2xl:mt-44 xl:mt-48 lg:mt-48 md:mt-24 sm:mt-28 px-6 py-2 bg-[#FF4C15] text-white font-semibold absolute 3xl:left-72 2xl:left-72 xl:left-72 lg:left-72 md:left-64 sm:left-10 3xl:block 2xl:block xl:block lg:block md:block sm:hidden"
                >
                  Claim Offer
                </Motion.button>
              </Link>
            </header>
          </div>
          {/* Right Image Section */}
          <Motion.figure
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative 3xl:top-28 2xl:top-28 xl:top-28 lg:top-28 md:top-36 sm:top-16"
          >
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1752122855/order6_cmhxns.webp"
              alt="Roast Brew Dish with weekly offer"
              className="w-full h-auto object-cover"
            />
            <Motion.figcaption
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              transition={{ duration: 1.2, delay: 0.5 }}
              className="hidden xl:block absolute -z-10 text-[10rem] font-bold text-gray-100 top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 select-none pointer-events-none"
              aria-hidden="true"
            >
              Off
            </Motion.figcaption>
          </Motion.figure>
        </div>
      </section>
    </Container>
  );
};

export default Brew;