"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { memo, useMemo, useState, useCallback } from "react";
import { HiMenuAlt3 } from "react-icons/hi";
import { motion as Motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Menu", path: "/menu" },
  { name: "Our Chefs", path: "/chefs" },
];

const Navbar = () => {
  const currentPath = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = "https://placehold.co/40x40/CCCCCC/333333?text=Logo";
  };

  const handleTableImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = "https://placehold.co/20x20/CCCCCC/333333?text=X";
  };

  return (
    <nav
      aria-label="Primary Navigation"
      className="sticky flex flex-col items-center w-20 p-4 z-20 3xl:-mt-[8rem] 2xl:-mt-[8rem] xl:-mt-[8.5rem] lg:-mt-[9.5rem] md:-mt-[7rem] sm:-mt-[7rem]"
    >
      {/* Cuisine Logo */}
      <Link href="/" aria-label="Cuisine Home">
        <div className="absolute left-0 top-0 w-10 md:w-20 lg:w-20 xl:w-24 2xl:w-28 3xl:w-32 bg-[#2C6252] flex flex-col items-center py-3 xl:py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Cuisine Logo"
            loading="lazy"
            className="h-4 sm:h-4 lg:h-3 xl:h-4 2xl:h-5 3xl:h-6 w-auto md:ml-8 lg:ml-10 xl:ml-10 2xl:ml-16 3xl:ml-20"
            onError={handleImgError}
          />
          <span
            className="sm:text-[13px] md:text-[12px] lg:text-[10px] xl:text-[13px] 2xl:text-[15px] 3xl:text-lg font-bold text-white mt-4 md:ml-8 lg:ml-10 xl:ml-10 2xl:ml-[3.9rem] 3xl:ml-20"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Cuisine
          </span>
        </div>
      </Link>

      {/* Hamburger for small screens */}
      <div className="sm:block md:block lg:hidden xl:hidden 2xl:hidden 3xl:hidden mt-28 md:ml-8 -ml-10">
        <button
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
          onClick={toggleMenu}
          className="text-[#2C6252] text-2xl"
          aria-label="Toggle menu"
          type="button"
        >
          <HiMenuAlt3 />
        </button>

        {/* Dropdown menu */}
        <AnimatePresence>
          {isOpen && (
            <Motion.div
              id="mobile-menu"
              key="dropdown"
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -80, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
              className="bg-white shadow-lg rounded-md w-48 absolute left-8 md:left-20 top-[7.5rem] z-50 p-4 space-y-3"
            >
              {navItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.path}
                  className={`block text-sm font-medium ${
                    currentPath === item.path
                      ? "text-[#2C6252]"
                      : "text-gray-600 hover:text-[#2C6252]"
                  }`}
                  onClick={closeMenu}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                href="/table"
                className="block bg-[#FF4C15] text-white text-center py-2 rounded-md text-sm font-semibold hover:bg-orange-600 transition"
                onClick={closeMenu}
              >
                Book a Table
              </Link>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Large screen nav menu */}
      <div className="hidden lg:flex flex-col 3xl:gap-8 2xl:gap-6 xl:gap-6 lg:gap-5 w-full items-center 3xl:mt-44 2xl:mt-36 xl:mt-28 lg:mt-24 3xl:ml-32 2xl:ml-[5.8rem] xl:ml-[3.5rem] lg:ml-[2.8rem]">
        {navItems.map((item, index) => (
          <Link
            key={index}
            href={item.path}
            className={`3xl:text-[15px] 2xl:text-[13px] xl:text-[11px] lg:text-[9px]   ${
              currentPath === item.path
                ? "text-[#2C6252]"
                : "text-[#919191] hover:text-[#2C6252]"
            }`}
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              display: "inline-block",
            }}
          >
            {item.name}
          </Link>
        ))}
      </div>

      {/* Book Table Button for large screens only */}
      <button className="hidden lg:flex bg-[#FF4C15] flex-col items-center 3xl:py-4 3xl:px-3 2xl:py-3 2xl:px-3 xl:py-3 xl:px-3 lg:py-2 lg:px-2 w-full 3xl:ml-32 2xl:ml-24 xl:ml-14 lg:ml-12 3xl:mt-10 2xl:mt-6 xl:mt-4 lg:mt-4">
        <Link href="/table" aria-label="Book a Table">
          <span
            className="3xl:text-[18px] 2xl:text-[15px] xl:text-[13px] lg:text-[9px] font-bold text-white"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Book a Table
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/table.svg"
            alt="Table Icon"
            loading="lazy"
            className="3xl:h-5 2xl:h-4 xl:h-4 lg:h-3 w-auto 3xl:mt-4 2xl:mt-3 xl:mt-2 lg:mt-2"
            onError={handleTableImgError}
          />
        </Link>
      </button>
    </nav>
  );
};

export default memo(Navbar);
