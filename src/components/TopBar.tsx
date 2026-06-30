"use client";

import { useEffect, useState, useMemo, memo } from "react";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import Container from "@/components/Container";
import AccountMenu from "@/components/AccountMenu";

// 🔧 Restaurant location config — change these to match your restaurant
const RESTAURANT_TIMEZONE = "Asia/Dhaka"; // IANA timezone name — restaurant is in Bangladesh
const KITCHEN_OPEN_HOUR = 10; // 24-hour format, e.g. 10 = 10 AM
const KITCHEN_CLOSE_HOUR = 22; // 24-hour format, e.g. 22 = 10 PM

// Rounds trig output to a fixed precision so server and client renders
// always produce an identical string — prevents hydration mismatches caused
// by tiny floating-point differences between Node.js and browser Math engines.
const round = (n: number) => Math.round(n * 10000) / 10000;

const AnalogClock = memo(() => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const radius = 20;
  const center = radius;

  const sec = time.getSeconds() * 6;
  const min = time.getMinutes() * 6 + time.getSeconds() * 0.1;
  const hour = ((time.getHours() % 12) / 12) * 360 + time.getMinutes() * 0.5;

  const renderTicks = () =>
    Array.from({ length: 12 }, (_, i) => {
      const angle = (i * 30 * Math.PI) / 180;
      const x1 = round(center + (radius - 2) * Math.sin(angle));
      const y1 = round(center - (radius - 2) * Math.cos(angle));
      const x2 = round(center + (radius - 4) * Math.sin(angle));
      const y2 = round(center - (radius - 4) * Math.cos(angle));
      return (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#44B78B"
          strokeWidth="1"
          strokeLinecap="round"
        />
      );
    });

  const hourX2 = round(center + (radius - 10) * Math.sin((hour * Math.PI) / 180));
  const hourY2 = round(center - (radius - 10) * Math.cos((hour * Math.PI) / 180));
  const minX2 = round(center + (radius - 6) * Math.sin((min * Math.PI) / 180));
  const minY2 = round(center - (radius - 6) * Math.cos((min * Math.PI) / 180));
  const secX2 = round(center + (radius - 4) * Math.sin((sec * Math.PI) / 180));
  const secY2 = round(center - (radius - 4) * Math.cos((sec * Math.PI) / 180));

  return (
    <svg
      viewBox="0 0 40 40"
      className="h-3 w-3 md:h-5 md:w-5 drop-shadow-sm 3xl:ml-0 2xl:ml-0 xl:ml-2 lg:ml-2"
      role="img"
      aria-label="Analog clock showing current time"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="clockGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#D2F1E5" />
        </radialGradient>
      </defs>
      <circle
        cx={center}
        cy={center}
        r={radius - 1}
        stroke="#2C6252"
        strokeWidth="1.5"
        fill="url(#clockGradient)"
      />
      {renderTicks()}
      <line
        x1={center}
        y1={center}
        x2={hourX2}
        y2={hourY2}
        stroke="#2C6252"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1={center}
        y1={center}
        x2={minX2}
        y2={minY2}
        stroke="#2C6252"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1={center}
        y1={center}
        x2={secX2}
        y2={secY2}
        stroke="#FF4C15"
        strokeWidth="1"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 1px #FF4C15)" }}
      />
      <circle cx={center} cy={center} r="1.5" fill="#FF4C15" />
    </svg>
  );
});
AnalogClock.displayName = "AnalogClock";

const TopBar = memo(() => {
  const [time, setTime] = useState(new Date());
  const [isKitchenOpen, setIsKitchenOpen] = useState(true);
  const { cartCount } = useCart();

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now);

      // Get the current hour specifically in the restaurant's timezone
      const hourInRestaurantTz = parseInt(
        new Intl.DateTimeFormat("en-US", {
          timeZone: RESTAURANT_TIMEZONE,
          hour: "numeric",
          hourCycle: "h23",
        }).format(now),
        10,
      );

      setIsKitchenOpen(
        hourInRestaurantTz >= KITCHEN_OPEN_HOUR &&
          hourInRestaurantTz < KITCHEN_CLOSE_HOUR,
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Time displayed is always the restaurant's local time, regardless of visitor location
  const formattedTime = useMemo(() => {
    return time
      .toLocaleTimeString("en-US", {
        timeZone: RESTAURANT_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
      .replace(/ (AM|PM)/, "");
  }, [time]);

  const ampm = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: RESTAURANT_TIMEZONE,
      hour: "numeric",
      hour12: true,
    })
      .format(time)
      .split(" ");
    return parts[1] || "AM";
  }, [time]);

  return (
    <div className="flex items-center justify-center relative z-30">
      <Container>
        <div className="flex flex-col sm:flex-row items-center bg-white px-4 sm:px-6 text-gray-700 text-sm relative z-30 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-10 md:-ml-0 -ml-28 overflow-visible">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1752050762/Group_22_fhiuuw.png"
            alt="Group 22"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "https://placehold.co/600x400?text=Image";
            }}
            className="w-full sm:w-auto h-auto sm:h-[10.5rem] md:h-[18rem] lg:h-[20rem] xl:h-[23rem] 2xl:h-[24rem] 3xl:h-[25rem] sm:-mt-[5.4rem] 3xl:-mt-[13rem] 2xl:-mt-[13rem] xl:-mt-[13rem] lg:-mt-[11rem] md:-mt-[11rem] sm:-ml-2 3xl:ml-16 lg:-ml-8 md:-ml-16"
          />
          <div className="flex flex-col sm:flex-row items-start sm:items-center w-full sm:-ml-9 3xl:-ml-12 2xl:-ml-14 xl:-ml-14 lg:-ml-14 md:-ml-16 md:-mt-8 sm:-mt-10 relative">
            <span className="text-[#E4E4E4] 3xl:mr-4 2xl:mr-4 xl:mr-4 lg:mr-4 md:mr-4 sm:mr-2 text-base sm:text-sm md:text-sm 3xl:text-[20px] 2xl:text-[18px] xl:text-[17px] lg:text-[14px] md:text-[0.8rem] sm:text-[0.7rem] mb-2 sm:mb-0 whitespace-nowrap sm:hidden 3xl:block 2xl:block xl:block lg:block md:block">
              Online place order
            </span>

            <div className="relative inline-block group">
              <Link
                href={isKitchenOpen ? "/order" : "#"}
                aria-label={isKitchenOpen ? "Order Now" : "Unavailable"}
                onClick={(e) => {
                  if (!isKitchenOpen) e.preventDefault();
                }}
              >
                <div
                  className={`${
                    isKitchenOpen
                      ? "bg-[#FF4C15] text-white cursor-pointer"
                      : "bg-gray-400 text-gray-200 cursor-not-allowed"
                  } text-[10px] md:text-base 3xl:text-[20px] 2xl:text-[18px] xl:text-[17px] lg:text-[14px] md:text-[0.8rem] px-1 3xl:px-3 2xl:px-3 xl:px-3 lg:px-3 md:px-3 py-0 3xl:py-2 2xl:py-2 xl:py-2 lg:py-2 md:py-1 rounded-sm flex items-center font-semibold mb-2 sm:mb-0 whitespace-nowrap w-full justify-center transition-transform`}
                >
                  {isKitchenOpen ? "Order Now" : "Unavailable"}
                </div>
              </Link>

              {!isKitchenOpen && (
                <div className="absolute top-full left-0 mt-1 px-2 py-0 w-full bg-black text-white text-center text-xs md:text-sm 3xl:text-base opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-sm">
                  Kitchen will open at {KITCHEN_OPEN_HOUR}:00 (restaurant time)
                </div>
              )}
            </div>

            <div className="mx-0 3xl:mx-2 2xl:mx-2 xl:mx-2 lg:mx-2 md:mx-1 mb-2 sm:mb-0">
              <div className="h-3 w-[1px] md:w-[2px] md:h-4 bg-gray-400 ml-2" />
            </div>

            <div className="flex flex-col md:flex-col lg:flex-row 3xl:space-x-4 2xl:space-x-4 xl:space-x-4 lg:space-x-4 md:space-y-2 sm:space-y-0 space-y-1 lg:space-y-0 mr-0 sm:mr-2 md:mr-4 mb-2 sm:mb-0 ml-2 sm:mt-5 3xl:mt-0 2xl:mt-0 xl:mt-0 lg:mt-0 md:mt-6">
              <div className="flex items-center 3xl:space-x-3 2xl:space-x-3 xl:space-x-3 lg:space-x-3 md:space-x-4 space-x-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    isKitchenOpen ? "/kitchen.svg" : "/kitchen-unavailable.svg"
                  }
                  alt={
                    isKitchenOpen ? "Kitchen available" : "Kitchen unavailable"
                  }
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "https://placehold.co/20x20?text=X";
                  }}
                  className="h-3 w-3 md:h-5 md:w-5"
                />
                <span
                  className={`3xl:text-[16px] 2xl:text-[15px] xl:text-[15px] lg:text-[13px] md:text-[0.8rem] text-[0.6rem] font-semibold whitespace-nowrap ${
                    isKitchenOpen ? "text-[#2C6252]" : "text-[#FF4C15]"
                  }`}
                >
                  {isKitchenOpen ? "Kitchen available" : "Kitchen unavailable"}
                </span>
              </div>

              <div className="flex items-center space-x-2 3xl:ml-2 2xl:ml-2 xl:ml-2 lg:ml-2 md:ml-0 ml-[0.1rem]">
                <AnalogClock />
                <div className="inline-flex items-baseline 3xl:min-w-[100px] 2xl:min-w-[90px] xl:min-w-[80px] lg:min-w-[50px] justify-end">
                  <span
                    className="3xl:text-[16px] 2xl:text-[15px] xl:text-[15px] lg:text-[13px] md:text-[13px] text-[9px] text-[#2C6252] font-semibold whitespace-nowrap [font-variant-numeric:tabular-nums] md:ml-2"
                    style={{
                      minWidth: "82px",
                      display: "inline-block",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formattedTime}
                  </span>
                  <span className="text-[#2C6252] font-semibold text-[9px] md:text-[13px] lg:text-[13px] xl:text-[15px] 2xl:text-[15px] 3xl:text-[16px] -ml-2">
                    {ampm}
                  </span>
                </div>
              </div>
            </div>

            <div className="3xl:ml-auto 2xl:ml-auto xl:ml-auto lg:ml-auto md:ml-auto sm:ml-6 mb-2 sm:mb-0 flex items-center gap-3 3xl:gap-4 2xl:gap-4 relative z-40">
              <AccountMenu />

              <div className="relative">
                <Link href="/carts" aria-label="View shopping cart">
                  <div className="relative 3xl:w-9 3xl:h-9 2xl:w-9 2xl:h-9 xl:w-9 xl:h-9 lg:w-9 lg:h-9 md:w-9 md:h-9 w-6 h-6 rounded-full bg-white border border-[#FF4C15] flex items-center justify-center shadow-[0_1px_4px_rgba(0,0,0,0.1)] hover:scale-105 transition-transform">
                    <ShoppingCart
                      className="w-4 h-4 md:w-5 md:h-5 text-[#FF4C15]"
                      strokeWidth={2.2}
                    />
                    <div className="absolute -top-1.5 -right-1.5 bg-[#FF4C15] text-white text-[10px] md:text-[11px] font-bold rounded-full h-4 w-4 flex items-center justify-center shadow-md border-2 border-white">
                      {cartCount}
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
});
TopBar.displayName = "TopBar";

export default TopBar;