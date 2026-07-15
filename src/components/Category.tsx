"use client";

import { useState, useEffect, ReactNode } from "react";
import { motion as Motion, type Variants } from "framer-motion";
import Container from "@/components/Container";
import { FaMugHot } from "react-icons/fa";
import { PiPizzaBold } from "react-icons/pi";
import { GiCutDiamond, GiMushroom } from "react-icons/gi";
import { BsCartX } from "react-icons/bs";
import { useCart } from "@/context/CartContext";
import { toast } from "react-toastify";
import { MdKeyboardArrowDown, MdKeyboardArrowUp } from "react-icons/md";

interface FoodItem {
  id: number;
  title: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

interface Tab {
  name: string;
  icon: ReactNode;
}

const foodData: FoodItem[] = [
  {
    id: 1,
    title: "Crispy Fried Chicken",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    id: 2,
    title: "Crispy Chicken",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    id: 3,
    title: "Crispy Hot Chicken",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    id: 4,
    title: "Fried Chicken",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 8,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    id: 5,
    title: "Normal Fried Chicken",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 6,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    id: 6,
    title: "Average Fried Chicken",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 4,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    id: 7,
    title: "Thai Fried Chicken",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 2,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121470/order1_ea6o5o.webp",
    category: "Signature",
  },
  {
    id: 8,
    title: "Mozila Mushrooms",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 16,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    id: 9,
    title: "Donald Mushrooms",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    id: 12,
    title: "Sticky Mushrooms",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    id: 11,
    title: "Mehoniz Mushrooms",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    id: 12,
    title: "Italian Mushrooms",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 9,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    id: 13,
    title: "Hot Mushrooms",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 6,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    id: 14,
    title: "Normal Mushrooms",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 4,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752121724/order2_hizrrd.webp",
    category: "Mushroom",
  },
  {
    id: 15,
    title: "Cappuccino Creamy",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    id: 16,
    title: "Cappuccino Coffee",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 13,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    id: 17,
    title: "Cappuccino Italian",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    id: 18,
    title: "Cappuccino Mozila",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 11,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    id: 19,
    title: "Cappuccino Cup",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 10,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    id: 20,
    title: "Cappuccino Brazilian",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 8,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    id: 21,
    title: "Cappuccino Latte",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 7,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122040/order3_tsiibf.webp",
    category: "Coffee",
  },
  {
    id: 22,
    title: "Pepperoni Pizza",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 26,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    id: 23,
    title: "Pepperoni Mojito",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 22,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    id: 24,
    title: "Pepperoni Deluxe",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 20,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    id: 25,
    title: "Pepperoni Supreme",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 18,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    id: 26,
    title: "Pepperoni Special",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 16,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    id: 27,
    title: "Pepperoni Fieasta",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 14,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
  {
    id: 28,
    title: "Pepperoni Normal",
    description: "Our menu is carefully crafted by expert chefs who bring creativity",
    price: 12,
    image: "https://res.cloudinary.com/dxohwanal/image/upload/v1752122232/order4_vzsqsc.webp",
    category: "Pizza",
  },
];

const tabs: Tab[] = [
  { name: "Signature", icon: <GiCutDiamond size={18} /> },
  { name: "Mushroom", icon: <GiMushroom size={18} /> },
  { name: "Coffee", icon: <FaMugHot size={18} /> },
  { name: "Pizza", icon: <PiPizzaBold size={18} /> },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

// Kitchen hours logic
const isKitchenOpen = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 10 && hour < 22; // Open 10 AM to 10 PM
};

const Category = () => {
  const [activeTab, setActiveTab] = useState<string>("Coffee");
  const { addToCart, cartItems } = useCart();
  const [showAll, setShowAll] = useState(false);
  const [isSmallDevice, setIsSmallDevice] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallDevice(window.innerWidth <= 640);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredItems = foodData.filter((item) => item.category === activeTab);

  return (
    <Container>
      <section
        className="3xl:px-14 2xl:px-4 xl:px-14 lg:px-0 md:px-0 3xl:mb-40 2xl:mb-52 xl:mb-36 lg:mb-52 mt-6 overflow-hidden md:-ml-12 sm:-ml-28 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-0"
        aria-labelledby="category-heading"
      >
        <Motion.h2
          id="category-heading"
          className="3xl:text-3xl 2xl:text-3xl xl:text-3xl lg:text-2xl md:text-2xl sm:text-xl font-semibold text-[#1D4B3F] mb-10"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          Delicious <span className="font-bold ml-2">Foods</span>
        </Motion.h2>

        <nav aria-label="Food categories">
          <div className="flex justify-start gap-6 mb-10 flex-wrap">
            {tabs.map((tab, i) => (
              <Motion.button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex items-center gap-2 px-6 py-2 border font-medium text-sm transition-all ${
                  activeTab === tab.name
                    ? "bg-[#FF4C15] border-[#FF4C15] text-white"
                    : "bg-gray-100 border-gray-300 text-gray-500"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                variants={fadeUp}
                custom={i}
                initial="hidden"
                animate="visible"
                aria-pressed={activeTab === tab.name}
                aria-label={`Filter to ${tab.name} foods`}
              >
                {tab.icon}
                {tab.name}
              </Motion.button>
            ))}
          </div>
        </nav>

        {/* This div is for larger devices where all items are shown */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {filteredItems.slice(0, 3).map((item, i) => (
            <FoodCard
              key={item.id}
              item={item}
              addToCart={addToCart}
              cartItems={cartItems}
              index={i}
            />
          ))}
        </div>
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 3xl:gap-6 2xl:gap-6 xl:gap-6 lg:gap-4 md:gap-4 mt-12">
          {filteredItems.slice(3, 7).map((item, i) => (
            <FoodCard
              key={item.id}
              item={item}
              addToCart={addToCart}
              cartItems={cartItems}
              index={i + 3}
            />
          ))}
        </div>

        {/* This div is for small devices where the single-column layout and show/hide functionality is applied */}
        <div className="md:hidden grid grid-cols-1 gap-6 mb-6">
          {isSmallDevice && !showAll
            ? filteredItems.slice(0, 2).map((item, i) => (
                <FoodCard
                  key={item.id}
                  item={item}
                  addToCart={addToCart}
                  cartItems={cartItems}
                  index={i}
                />
              ))
            : filteredItems.map((item, i) => (
                <FoodCard
                  key={item.id}
                  item={item}
                  addToCart={addToCart}
                  cartItems={cartItems}
                  index={i}
                />
              ))}
        </div>

        {isSmallDevice && filteredItems.length > 2 && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-2 px-4 py-2 text-[#2C6252] font-semibold text-sm transition-all"
            >
              {showAll ? (
                <MdKeyboardArrowUp size={28} />
              ) : (
                <MdKeyboardArrowDown size={28} />
              )}
            </button>
          </div>
        )}
      </section>
    </Container>
  );
};

interface FoodCardProps {
  item: FoodItem;
  addToCart: ReturnType<typeof useCart>["addToCart"];
  cartItems: ReturnType<typeof useCart>["cartItems"];
  index: number;
}

const FoodCard = ({ item, addToCart, cartItems, index }: FoodCardProps) => {
  const itemId = String(item.id);
  const isAlreadyInCart = cartItems.some((cartItem) => cartItem.id === itemId);

  const handleClick = () => {
    if (isAlreadyInCart) {
      toast.warning(`${item.title} is already in cart!`, { position: "top-center", autoClose: 2000 });
    } else {
      addToCart({
        id: itemId,
        title: item.title,
        price: item.price,
        quantity: 1,
        imageUrl: item.image,
      });
      toast.success(`${item.title} added to cart!`, { position: "top-center", autoClose: 2000 });
    }
  };

  return (
    <Motion.article
      className="bg-[#F8F8F8] overflow-hidden flex flex-col p-6"
      variants={fadeUp}
      custom={index}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.02 }}
      aria-label={`Food card: ${item.title}`}
    >
      <figure className="w-full 3xl:h-60 2xl:h-60 xl:h-44 lg:h-36 overflow-hidden">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover"
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            target.src = "https://placehold.co/400x240/CCCCCC/FFFFFF?text=Image+Not+Found";
          }}
        />
      </figure>
      <div className="flex flex-col flex-grow mt-6">
        <h3 className="3xl:text-xl 2xl:text-xl xl:text-xl lg:text-lg font-semibold text-[#2C6252] leading-tight mb-1">
          {item.title}
        </h3>
        <p className="text-xs text-[#CCCCCC] mb-4 flex-grow mt-2">
          {item.description}
        </p>
        <div className="flex justify-between items-center mt-auto">
          <span className="3xl:text-3xl 2xl:text-3xl xl:text-3xl lg:text-xl font-bold text-[#2C6252]">
            ${item.price}
            <span className="3xl:text-lg 2xl:text-lg xl:text-lg lg:text-sm text-[#B9B9B9] relative top-2 left-1 font-semibold">
              / pcs
            </span>
          </span>
          {/* Kitchen-aware button */}
          <div className="relative inline-block group">
            {isKitchenOpen() ? (
              <button
                className="bg-[#2C6252] text-white p-2 focus:outline-none focus:ring-2 focus:ring-[#2C6252] focus:ring-opacity-50"
                onClick={handleClick}
                aria-label={`Add ${item.title} to cart`}
              >
                <img src="/Path 2764.svg" alt="Add to cart" />
              </button>
            ) : (
              <button
                className="bg-gray-400 text-white p-2 cursor-not-allowed flex items-center justify-center"
                disabled
                aria-label={`Kitchen is closed, cannot add ${item.title} to cart`}
              >
                <BsCartX size={20} />
              </button>
            )}

            {!isKitchenOpen() && (
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full mr-2 px-2 py-1 bg-black text-white text-xs rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
                Kitchen will open at 10 AM
              </div>
            )}
          </div>
        </div>
      </div>
    </Motion.article>
  );
};

export default Category;