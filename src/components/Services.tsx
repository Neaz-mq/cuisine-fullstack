"use client";

import { useEffect, useState } from "react";
import Container from "@/components/Container";
import { motion as Motion } from "framer-motion";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

const services = [
  {
    icon: "/Path 67.svg",
    title: "Fresh and High-Quality Ingredients",
    desc: "We source only the freshest and highest-quality ingredients ",
  },
  {
    icon: "/unique.svg",
    title: "Unique and Delicious Menu",
    desc: "Our menu is carefully crafted by expert chefs who bring creativity",
  },
  {
    icon: "/customer.svg",
    title: "Outstanding Customer Service",
    desc: "Our staff is dedicated to providing warm and attentive services",
  },
  {
    icon: "/cazy.svg",
    title: "Cozy and Inviting Atmosphere",
    desc: "We have designed our restaurant to offer a comfortable and stylish",
  },
  {
    icon: "/safety.svg",
    title: "Commitment to Cleanliness and Safety",
    desc: "We adhere to the highest standards of hygiene and food safety",
  },
  {
    icon: "/value.svg",
    title: "Affordable Prices with Great Value",
    desc: "We believe that exceptional food should be accessible to everyone",
  },
];

const Services = () => {
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

  const visibleServices =
    isSmallScreen && !showAll ? services.slice(0, 2) : services;

  return (
    <div className="3xl:-mt-[3rem] 2xl:-mt-[3rem] xl:-mt-[4rem] lg:-mt-[6rem] md:-mt-[10rem] sm:-mt-[10rem] flex justify-center sm:-ml-[5rem] 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-0 md:-ml-0 z-10">
      <Container>
        <section
          className="relative w-full flex flex-col items-center justify-center mb-8 2xl:mr-5 3xl:mr-0 xl:mr-0 lg:right-3 md:right-10 sm:right-7"
          aria-labelledby="services-title"
        >
          {/* Background image (decorative) */}
          <div
            className="absolute inset-0 bg-no-repeat bg-center bg-contain pointer-events-none 3xl:-top-[40rem] 2xl:-top-[40rem] xl:-top-[40rem] lg:-top-[30rem] md:-top-[30rem] sm:-top-[30rem]"
            style={{
              backgroundImage:
                'url("https://res.cloudinary.com/dxohwanal/image/upload/v1745037051/Stand_out_aj6upw.png")',
            }}
            aria-hidden="true"
          />

          {/* Section Header */}
          <Motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative z-10 text-center mt-[15rem]"
          >
            <h2 className="text-gray-500 text-xs font-semibold tracking-wide mb-2">
              <span
                className="bg-[#FF4C15] text-white py-1 px-4 rounded-full flex items-center justify-center rotate-[5deg] w-fit mx-auto"
                aria-label="Your Services and Benefits"
              >
                <span className="bg-white rounded-full w-5 h-5 flex items-center justify-center mr-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/svg.png"
                    className="w-3 h-3"
                    alt="Service Badge Icon"
                    loading="lazy"
                  />
                </span>
                <span className="text-xs">
                  Your Services <span className="font-thin">(And Benefits)</span>
                </span>
              </span>
            </h2>

            <h1
              id="services-title"
              className="3xl:text-5xl 2xl:text-4xl xl:text-3xl lg:text-2xl md:text-2xl sm:text-lg font-semibold text-[#2C6252] 3xl:mt-10 2xl:mt-10 xl:mt-8 lg:mt-10 sm:mt-5 mb-6"
            >
              What Makes Us Stand Out
            </h1>

            <p className="text-[#888888] 3xl:text-base 2xl:text-base xl:text-base lg:text-sm md:text-sm sm:text-[9px] font-normal leading-relaxed max-w-2xl mx-auto">
              At <span className="font-medium">[Restaurant Name]</span>, we don&apos;t
              just serve food—
              <br />
              we create unforgettable dining experiences. From the moment you step
              through our doors.
            </p>
          </Motion.div>

          {/* Services Grid */}
          {isSmallScreen ? (
            <div
              key={showAll ? "all" : "limited"}
              className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-6 mt-14"
              role="list"
            >
              {visibleServices.map((service) => {
                const words = service.desc.split(" ");
                const firstLine = words.slice(0, 5).join(" ");
                const secondLine = words.slice(4).join(" ");

                return (
                  <div
                    key={service.title}
                    className="flex items-start gap-4 max-w-md"
                    role="listitem"
                  >
                    <div className="flex-shrink-0 sm:w-10 sm:h-10 bg-[#2C6252] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={service.icon}
                        alt={`${service.title} Icon`}
                        className="sm:w-4 sm:h-4 object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="sm:text-[13px] font-semibold text-[#2C6252] mb-1 leading-snug max-w-[220px]">
                        {service.title}
                      </h3>
                      <p className="text-[#CCCCCC] sm:text-[8px] py-2 leading-snug">
                        {firstLine}
                        <br />
                        {secondLine}
                      </p>
                      <button
                        type="button"
                        className="text-[11px] text-[#2C6252] font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2C6252]"
                        aria-label={`Discover more about ${service.title}`}
                      >
                        Discover More
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Motion.div
              key={showAll ? "all" : "limited"}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.15,
                  },
                },
              }}
              className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 3xl:gap-y-16 2xl:gap-y-16 xl:gap-y-16 lg:gap-y-16 md:gap-y-16 sm:gap-y-16 3xl:gap-24 2xl:gap-24 xl:gap-16 lg:gap-4 md:gap-4 sm:gap-4 mt-20 2xl:mr-10 lg:mr-3 md:mr-3 sm:mr-3 3xl:mr-0 xl:mr-0"
              role="list"
            >
              {visibleServices.map((service) => {
                const words = service.desc.split(" ");
                const firstLine = words.slice(0, 5).join(" ");
                const secondLine = words.slice(4).join(" ");

                return (
                  <Motion.div
                    key={service.title}
                    variants={{
                      hidden: { opacity: 0, y: 30 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex items-start gap-4 max-w-md"
                    role="listitem"
                  >
                    <div className="flex-shrink-0 3xl:w-16 3xl:h-16 2xl:w-16 2xl:h-16 xl:w-14 xl:h-14 lg:w-14 md:w-14 sm:w-10 lg:h-14 md:h-14 sm:h-10 bg-[#2C6252] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={service.icon}
                        alt={`${service.title} Icon`}
                        className="3xl:w-7 3xl:h-7 2xl:w-10 2xl:h-10 xl:w-6 xl:h-6 lg:w-4 lg:h-4 md:w-4 md:h-4 sm:w-4 sm:h-4 object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="3xl:text-lg 2xl:text-lg xl:text-base lg:text-[16px] md:text-[16px] sm:text-[13px] font-semibold text-[#2C6252] mb-1 leading-snug max-w-[220px]">
                        {service.title}
                      </h3>
                      <p className="text-[#CCCCCC] 3xl:text-[12px] 2xl:text-[9px] xl:text-[8px] lg:text-[8px] md:text-[6px] sm:text-[8px] py-2 leading-snug">
                        {firstLine}
                        <br />
                        {secondLine}
                      </p>
                      <button
                        type="button"
                        className="text-[11px] text-[#2C6252] font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2C6252]"
                        aria-label={`Discover more about ${service.title}`}
                      >
                        Discover More
                      </button>
                    </div>
                  </Motion.div>
                );
              })}
            </Motion.div>
          )}

          {/* Dropdown toggle icon on small screens */}
          {isSmallScreen && (
            <div className="sm:flex md:hidden mt-10 z-10">
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="text-[#2C6252] flex flex-col items-center text-xl focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#2C6252]"
                aria-expanded={showAll}
                aria-controls="services-list"
                aria-label={showAll ? "Show less services" : "Show more services"}
              >
                {showAll ? (
                  <FaChevronUp className="animate-bounce" aria-hidden="true" />
                ) : (
                  <FaChevronDown className="animate-bounce" aria-hidden="true" />
                )}
              </button>
            </div>
          )}

          <div className="py-24" />
        </section>
      </Container>
    </div>
  );
};

export default Services;