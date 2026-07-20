"use client";

import { useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import Image from "next/image";
import Container from "@/components/Container";

const MotionImage = Motion(Image);

interface TestimonialCard {
  name: string;
  text: string;
  dots: [boolean, boolean];
  img?: string;
}

const images: string[] = [
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752052934/testimonial1_a2ozpv.webp",
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752053389/testimonial2_rkf0yx.webp",
  "https://res.cloudinary.com/dxohwanal/image/upload/v1752053648/testimonial3_h1phwx.webp",
];

const testimonialCards: TestimonialCard[] = [
  {
    name: "— Emily R.",
    text: "The food was absolutely delicious, and the service was top-notch! The ambiance made our dinner even more special. Highly recommend!",
    dots: [true, false],
    img: "https://res.cloudinary.com/dxohwanal/image/upload/v1748515898/Mask_Group_17_ke16wb.jpg",
  },
  {
    name: "— James T.",
    text: "I've been coming here for years, and the quality has never changed. Fresh ingredients, amazing flavors, and a welcoming staff. A must-visit!",
    dots: [true, true],
  },
  {
    name: "— Sophia M.",
    text: "From the moment we walked in, we were treated like family. The dishes were flavorful and beautifully presented. 10/10!",
    dots: [false, true],
  },
];

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;

const Testimonials = () => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(0);

  const paginate = (newDirection: number) => {
    const newIndex = currentIndex - newDirection;
    if (newIndex >= 0 && newIndex < images.length) {
      setDirection(newDirection);
      setCurrentIndex(newIndex);
    }
  };

  const goToSlide = (index: number) => {
    setDirection(index > currentIndex ? -1 : 1);
    setCurrentIndex(index);
  };

  return (
    <Container>
      <section
        className="relative bg-white px-8 3xl:px-2 2xl:px-6 xl:px-6 lg:px-2 mx-12 3xl:-top-56 2xl:-top-28 xl:-top-32 lg:-top-48 md:-top-48 sm:-top-80 sm:ml-2 sm:-mr-6 3xl:ml-12 3xl:-mr-6 2xl:ml-0 2xl:-mr-0 xl:ml-0 xl:-mr-0 lg:ml-0 lg:-mr-0 md:ml-0 md:-mr-0"
        aria-label="Customer testimonials section"
      >
        {/* Heading + Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <Motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h2
              className="3xl:text-5xl 2xl:text-5xl xl:text-4xl lg:text-3xl md:text-3xl sm:text-xl font-semibold text-[#2C6252] 3xl:leading-snug 2xl:leading-snug xl:leading-normal 3xl:mt-52 2xl:mt-14 xl:mt-14 lg:mt-24 md:mt-8 sm:mt-24 3xl:ml-2 2xl:-ml-4 xl:ml-4 lg:-ml-5 md:-ml-[2.8rem] sm:-ml-[7.8rem]"
              tabIndex={0}
            >
              Customer <br /> Testimonial <br />
              <span className="text-[#FF4C15]">Examples</span>
            </h2>
            <div className="flex">
              <p
                className="text-[#CCCCCC] 3xl:mt-14 2xl:mt-8 xl:mt-6 lg:mt-3 md:mt-3 sm:mt-3 max-w-md 3xl:text-[16px] 2xl:text-[16px] xl:text-[12px] lg:text-[10px] md:text-[10px] sm:text-[10px] 3xl:ml-3 2xl:-ml-[1rem] xl:ml-[1.2rem] lg:-ml-5 md:-ml-11 sm:-ml-[7.8rem]"
                tabIndex={0}
              >
                When I research companies online, I don&apos;t just want to hear the company&apos;s pitch; I want to hear from its customers.
              </p>
              <Motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="3xl:-mt-14 2xl:-mt-[2.4rem] xl:-mt-[2.4rem] lg:-mt-[3.5em] md:-mt-[2.1em] sm:-mt-[3.5em] 3xl:ml-6 2xl:ml-6 xl:ml-2 md:ml-2 sm:hidden md:block lg:block xl:block 2xl:block 3xl:block"
                aria-hidden="true"
              >
                <Image
                  src="https://res.cloudinary.com/dxohwanal/image/upload/v1747212688/asset1_rbxyxt.png"
                  alt="Decorative testimonial icon"
                  width={100}
                  height={100}
                />
              </Motion.div>
            </div>
          </Motion.div>

          {/* Swipeable Image Section */}
          <div
            className="relative 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full sm:w-[12rem] 3xl:h-[400px] 2xl:h-[400px] xl:h-[400px] lg:h-[200px] md:h-[200px] sm:h-[130px] overflow-hidden 3xl:ml-1 3xl:right-16 2xl:right-16 xl:right-14 lg:ml-16 md:ml-16 sm:-ml-[2.8rem] sm:right-20"
            aria-label="Testimonial image carousel"
          >
            <AnimatePresence initial={false} custom={direction}>
              <MotionImage
                key={currentIndex}
                src={images[currentIndex]}
                alt={`Testimonial visual ${currentIndex + 1}`}
                fill
                sizes="(min-width: 1024px) 40vw, 90vw"
                custom={direction}
                className="absolute object-cover"
                initial={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={1}
                onDragEnd={(_e, { offset, velocity }) => {
                  const swipe = swipePower(offset.x, velocity.x);
                  if (swipe < -swipeConfidenceThreshold) paginate(-1);
                  else if (swipe > swipeConfidenceThreshold) paginate(1);
                }}
                tabIndex={-1}
              />
            </AnimatePresence>

            {/* Slide Indicators */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {images.map((_, index) => (
                <Motion.button
                  key={index}
                  onClick={() => goToSlide(index)}
                  whileHover={{ scale: 1.2 }}
                  aria-label={`Go to slide ${index + 1}`}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? "bg-white border-2 border-[#FF4C15]"
                      : "bg-gray-300 border border-transparent"
                  }`}
                  type="button"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Testimonial Cards */}
        <div
          className="grid grid-cols-1 3xl:grid-cols-3 2xl:grid-cols-3 xl:grid-cols-3 lg:grid-cols-3 md:grid-cols-1 sm:grid-cols-1 3xl:gap-8 2xl:gap-8 xl:gap-6 lg:gap-3 md:gap-6 sm:gap-3 3xl:-mt-14 2xl:mt-24 xl:mt-14 lg:mt-10 md:mt-10 sm:mt-10 3xl:ml-3 3xl:mr-14 2xl:ml-0 2xl:mr-4 xl:ml-6 xl:mr-4 lg:ml-0 lg:mr-4 md:ml-0 md:mr-4 sm:-ml-[7.8rem] sm:mr-0"
          aria-label="Customer testimonials cards"
        >
          {testimonialCards.map((card, i) => (
            <Motion.article
              key={i}
              className="border border-orange-200 3xl:p-12 2xl:p-12 xl:p-12 lg:p-12 md:p-6 sm:p-4 bg-white sm:w-full 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              tabIndex={0}
              aria-label={`Testimonial from ${card.name}`}
            >
              <h4 className="3xl:text-lg 2xl:text-lg xl:text-lg lg:text-lg sm:text-base font-semibold text-green-900 mb-4">
                {card.name}
              </h4>
              <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-700">
                {card.text}
              </p>
              <div className="flex items-center mt-4 space-x-2">
                {card.img ? (
                  <>
                    <span className="w-6 h-6 bg-[#2C6252] rounded-full" aria-hidden="true" />
                    <Image
                      src={card.img}
                      alt={`Avatar of ${card.name}`}
                      width={24}
                      height={24}
                      className="w-6 h-6 border-2 border-[#FF4C15] rounded-full object-cover"
                    />
                  </>
                ) : (
                  ([0, 1] as const).map((idx) => (
                    <span
                      key={idx}
                      className={`w-6 h-6 rounded-full ${card.dots[idx] ? "bg-[#FF4C15]" : "bg-[#2C6252]"}`}
                      aria-hidden="true"
                    />
                  ))
                )}
              </div>
            </Motion.article>
          ))}
        </div>
      </section>
    </Container>
  );
};

export default Testimonials;