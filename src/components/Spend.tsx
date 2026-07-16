"use client";

import Link from "next/link";
import Image from "next/image";
import Container from "@/components/Container";
import { motion as Motion, type Variants } from "framer-motion";

// Motion variants
const textContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.8 },
  },
};

const letter: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.8 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 18 },
  },
};

// Kitchen open logic
const isKitchenOpen = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 10 && hour < 22;
};

const Spend = () => {
  const headerText1 = "If you spend ";
  const headerText2 = "special time";

  return (
    <Container>
      <section
        className="flex flex-col-reverse lg:flex-row items-center justify-between gap-8 3xl:gap-16 2xl:gap-16 xl:gap-16 lg:gap-16 3xl:py-16 2xl:py-16 xl:py-16 lg:py-4 md:py-4 mb-28 md:-ml-24 sm:-ml-28 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-0"
        aria-labelledby="spend-heading"
      >
        {/* Left: Image Section */}
        <Motion.div
          className="w-full flex justify-center 3xl:-ml-14 2xl:-ml-20 xl:-ml-10 lg:-ml-20 2xl:mt-8 3xl:mt-0"
          initial={{ opacity: 0, rotateY: 45, scale: 0.85 }}
          whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
          transition={{ duration: 1.8, ease: [0.43, 0.13, 0.23, 0.96] }}
          viewport={{ once: true }}
          style={{ perspective: 900 }}
        >
          <Image
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1752120958/table1_jf0nwc.webp"
            alt="Couple enjoying quality dining time at Flavors & Feast"
            width={700}
            height={500}
            sizes="(min-width: 1024px) 40vw, 90vw"
            className="w-[90%] max-w-md lg:max-w-full h-auto hidden md:block 3xl:block 2xl:block xl:block lg:block object-contain"
          />
        </Motion.div>

        {/* Right: Text Section */}
        <Motion.div
          className="w-full text-center lg:text-left 3xl:mt-4 2xl:mt-10 xl:mt-10 lg:mt-10 3xl:ml-36 2xl:ml-20 xl:ml-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={textContainer}
        >
          <header>
            <h2
              id="spend-heading"
              className="text-4xl 3xl:text-6xl 2xl:text-6xl xl:text-5xl lg:text-4xl md:text-4xl sm:text-xl font-bold text-[#2C6252] leading-relaxed mb-4"
            >
              {[...headerText1].map((char, index) => (
                <Motion.span
                  key={`char1-${index}`}
                  variants={letter}
                  style={{ display: "inline-block" }}
                >
                  {char === " " ? "\u00A0" : char}
                </Motion.span>
              ))}
              <br />
              <span className="text-[#2C6252] leading-relaxed">
                {[...headerText2].map((char, index) => (
                  <Motion.span
                    key={`char2-${index}`}
                    variants={letter}
                    style={{ display: "inline-block" }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </Motion.span>
                ))}
              </span>
            </h2>
          </header>

          <p className="text-[#D7D7D7] text-xs 3xl:text-base 2xl:text-base xl:text-sm lg:text-xs md:text-xs mt-4 max-w-md md:mx-auto 3xl:mx-0 2xl:mx-0 xl:mx-0 lg:mx-0">
            Discover unforgettable moments at Flavors & Feast — where every bite brings joy. Whether it&apos;s a romantic
            evening, a friends&apos; hangout, or a cozy weekend brunch, we&apos;ve got unbeatable food deals just for you.
          </p>

          {/* Mobile Image */}
          <Image
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1752120958/table1_jf0nwc.webp"
            alt="Couple enjoying quality dining time at Flavors & Feast"
            width={700}
            height={500}
            sizes="90vw"
            className="w-[90%] max-w-md h-auto block md:hidden mx-auto mt-4 object-contain"
          />

          {/* Kitchen-aware Checkout Button */}
          <div className="relative inline-block group mt-6">
            {isKitchenOpen() ? (
              <Link href="/order" aria-label="Checkout Menu now">
                <Motion.button
                  className="px-6 py-3 bg-[#FA4A0C] text-white font-semibold shadow-md"
                  whileHover={{
                    scale: 1.12,
                    boxShadow: "0 0 15px rgb(250 74 12 / 0.8)",
                    transition: { duration: 0.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  Checkout Menu
                </Motion.button>
              </Link>
            ) : (
              <>
                <Motion.button
                  className="px-6 py-3 bg-gray-400 text-gray-200 font-semibold shadow-md cursor-not-allowed"
                  disabled
                  aria-label="Ordering unavailable: kitchen is closed"
                >
                  Unavailable
                </Motion.button>
                <div className="absolute top-full left-0 mt-2 px-3 py-1 bg-black text-white text-center text-xs rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max max-w-[160px] pointer-events-none">
                  Kitchen will open at 10 AM
                </div>
              </>
            )}
          </div>
        </Motion.div>
      </section>
    </Container>
  );
};

export default Spend;