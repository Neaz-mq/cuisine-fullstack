"use client";

import { motion as Motion } from "framer-motion";
import Container from "@/components/Container";

const Explore = () => {
  return (
    <Container>
      {/* Responsive wrapper to fix overflow on small screens */}
      <div className="overflow-hidden sm:px-4 sm:-ml-[9.7rem] 3xl:-ml-0 2xl:-ml-[4rem] xl:-ml-[2.5rem] lg:-ml-[5rem] md:-ml-[7.2rem]">
        <section
          className="relative bg-white 3xl:-top-4 sm:-top-5"
          aria-labelledby="explore-heading"
          role="region"
        >
          <div className="flex flex-col sm:flex-row items-start justify-between">
            {/* Left Content */}
            <Motion.div
              className="relative 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-1/2 sm:w-1/2 p-4 sm:p-8 z-0"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              viewport={{ once: true }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="absolute left-[-20px] right-10 -top-10 opacity-60 blur-sm"
                src="/Ellipse 9.svg"
                alt=""
                role="presentation"
                aria-hidden="true"
              />

              <div className="ml-2 sm:ml-4 sm:hidden 3xl:block 2xl:block xl:block lg:block md:block">
                <Motion.h1
                  id="explore-heading"
                  className="text-2xl sm:text-2xl md:text-2xl lg:text-2xl xl:text-3xl 2xl:text-4xl 3xl:text-6xl font-bold text-[#2C6252] flex flex-col items-start -mt-3"
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1 }}
                  viewport={{ once: true }}
                >
                  <span className="mb-2 sm:mb-3">Explore Our</span>
                  <span className="mb-2 sm:mb-3">Full Menu of</span>
                  <span className="mb-2 sm:mb-3">Signature</span>
                  <span>Dishes</span>
                </Motion.h1>
              </div>

              <div>
                <Motion.h1
                  className="text-2xl sm:text-2xl md:text-2xl lg:text-2xl xl:text-3xl 2xl:text-4xl 3xl:text-6xl font-bold text-[#2C6252] flex flex-col items-start -mt-3"
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut", delay: 0.2 }}
                  viewport={{ once: true }}
                >
                  <span className="mb-2 sm:mb-3 text-lg sm:block 3xl:hidden 2xl:hidden xl:hidden lg:hidden md:hidden">
                    Explore Our full menu
                  </span>
                </Motion.h1>
              </div>

              <Motion.div
                className="3xl:-mt-4 2xl:-mt-4 xl:-mt-4 lg:-mt-16 md:-mt-16 sm:hidden 3xl:block 2xl:block xl:block lg:block md:block"
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                viewport={{ once: true }}
              >
                <p
                  className="mt-4 sm:mt-6 mb-8 text-[12px] sm:text-[14px] md:text-[14px] lg:text-[15px] xl:text-[16px] p-4 bg-cover bg-center w-full sm:w-[480px] md:w-[500px] xl:w-[500px] lg:w-[500px] 2xl:w-[650px] h-[200px] sm:h-[250px] flex flex-col justify-center"
                  style={{
                    backgroundImage:
                      "url('https://res.cloudinary.com/dxohwanal/image/upload/v1742627149/Tasty_uw9ilh.png')",
                  }}
                >
                  <span className="inline-flex sm:hidden 3xl:block 2xl:block xl:block lg:block md:block">
                    <span className="text-[#FF4C15] whitespace-nowrap">
                      Experience the perfect blend of taste and joy—
                    </span>
                  </span>
                  <span className="text-[#AAAAAA] 3xl:block 2xl:block xl:block lg:block md:block mt-2 sm:hidden">
                    every bite is moment of delight, crafted to satisfy your cravings!
                  </span>
                </p>
              </Motion.div>

              <p className="text-[7px] text-[#FF4C15] whitespace-nowrap 3xl:hidden 2xl:hidden xl:hidden lg:hidden md:hidden sm:block">
                Experience the perfect blend
              </p>
              <p className="text-[5px] text-[#AAAAAA] whitespace-nowrap 3xl:hidden 2xl:hidden xl:hidden lg:hidden md:hidden sm:block mt-1">
                every bite is a moment of delight satisfy
              </p>
            </Motion.div>

            {/* Right Image */}
            <Motion.figure
              className="3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-1/2 sm:w-28 sm:-ml-14 flex justify-center items-center 3xl:-mt-6"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              viewport={{ once: true }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://res.cloudinary.com/dxohwanal/image/upload/v1752054404/menu1_nkbnfg.webp"
                alt="Delicious full menu dishes display banner"
                className="w-full max-w-[380px] sm:max-w-[500px] md:max-w-[400px] 3xl:max-w-[800px] 2xl:max-w-[800px] xl:max-w-[800px] lg:max-w-[800px] object-contain mt-4 sm:mt-5 sm:ml-10"
              />
              <figcaption className="sr-only">
                Image showcasing a variety of signature dishes available on our menu.
              </figcaption>
            </Motion.figure>
          </div>
        </section>
      </div>
    </Container>
  );
};

export default Explore;