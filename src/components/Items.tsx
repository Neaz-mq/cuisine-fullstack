"use client";

import { useState, useEffect } from "react";
import { motion as Motion } from "framer-motion";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";
import { toast } from "react-toastify";

interface MenuItem {
  title: string;
  description: string;
  price: string;
  originalPrice: string;
  image: string;
  hasOrderButton: boolean;
}

interface TodaySpecial {
  text: string;
  mainImage: string;
}

interface CategoryItem {
  label: string;
  itemImage: string;
  mainContent: {
    items: MenuItem[];
    todaySpecial: TodaySpecial;
  };
}

const categoryItems: CategoryItem[] = [
  {
    label: "BURGERS",
    itemImage:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1747893314/burger_rpgir8.png",
    mainContent: {
      items: [
        {
          title: "Fresh Burger",
          description:
            "We source only the freshest and highest-quality ingredients to ensure every dish bursts with flavor.",
          price: "$300",
          originalPrice: "$562",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
          hasOrderButton: false,
        },
        {
          title: "Juicy Burger",
          description:
            "Our signature beef patty, cooked to perfection and served on a toasted bun with fresh veggies.",
          price: "$320",
          originalPrice: "$580",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
          hasOrderButton: true,
        },
        {
          title: "Spicy BBQ Burger",
          description:
            "A smoky and spicy delight with a zesty BBQ sauce, crispy onions, and melted cheese.",
          price: "$310",
          originalPrice: "$570",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
          hasOrderButton: false,
        },
        {
          title: "Mushroom Swiss Burger",
          description:
            "Earthy mushrooms and melted Swiss cheese complement our succulent beef patty perfectly.",
          price: "$305",
          originalPrice: "$565",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
          hasOrderButton: false,
        },
      ],
      todaySpecial: {
        text: 'Today<br />special<br /><span class="text-[#FF4C15]">Burger</span>',
        mainImage:
          "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
      },
    },
  },
  {
    label: "CHICKEN",
    itemImage:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1747893398/chicken_pibox1.png",
    mainContent: {
      items: [
        {
          title: "Crispy Fried Chicken",
          description:
            "Our chicken is fried to golden perfection, crispy on the outside, juicy on the inside, a true delight.",
          price: "$250",
          originalPrice: "$450",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
          hasOrderButton: true,
        },
        {
          title: "Spicy Chicken Wings",
          description:
            "Experience the fiery kick of our spicy chicken wings, perfect for those who love a bit of heat.",
          price: "$280",
          originalPrice: "$490",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
          hasOrderButton: false,
        },
        {
          title: "Grilled Chicken Salad",
          description:
            "Healthy and delicious, our grilled chicken salad is packed with fresh greens and tender chicken.",
          price: "$220",
          originalPrice: "$400",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
          hasOrderButton: false,
        },
        {
          title: "Chicken Nuggets Meal",
          description:
            "A perfect meal for the little ones, tender chicken nuggets with a side of crispy fries.",
          price: "$180",
          originalPrice: "$350",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129719/menu8_u5oue6.webp",
          hasOrderButton: false,
        },
      ],
      todaySpecial: {
        text: 'Today<br />special<br /><span class="text-[#FF4C15]">Chicken</span>',
        mainImage:
          "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
      },
    },
  },
  {
    label: "PIZZA",
    itemImage:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1747893341/pizza_hhbhaj.png",
    mainContent: {
      items: [
        {
          title: "Classic Pepperoni Pizza",
          description:
            "A timeless favorite with rich tomato sauce, mozzarella, and savory pepperoni slices.",
          price: "$450",
          originalPrice: "$700",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129875/menu9_eaczhq.webp",
          hasOrderButton: false,
        },
        {
          title: "Margherita Delight",
          description:
            "Simple yet perfect, with fresh basil, mozzarella, and a hint of olive oil on a crispy crust.",
          price: "$400",
          originalPrice: "$650",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129875/menu9_eaczhq.webp",
          hasOrderButton: true,
        },
        {
          title: "Veggie Supreme Pizza",
          description:
            "Loaded with a colorful array of fresh vegetables, olives, and bell peppers.",
          price: "$420",
          originalPrice: "$680",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752130054/menu10_fggjfb.webp",
          hasOrderButton: false,
        },
        {
          title: "Chicken BBQ Pizza",
          description:
            "Tangy BBQ sauce, grilled chicken, red onions, and cilantro create a unique flavor.",
          price: "$480",
          originalPrice: "$750",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752130054/menu10_fggjfb.webp",
          hasOrderButton: false,
        },
      ],
      todaySpecial: {
        text: 'Today<br />special<br /><span class="text-[#FF4C15]">Pizza</span>',
        mainImage:
          "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
      },
    },
  },
  {
    label: "SALAD",
    itemImage:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1747893487/salad_g519yo.png",
    mainContent: {
      items: [
        {
          title: "Garden Fresh Salad",
          description:
            "Crisp, fresh greens with a mix of vibrant vegetables and a light vinaigrette dressing.",
          price: "$150",
          originalPrice: "$280",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752130270/menu11_yizlj0.webp",
          hasOrderButton: false,
        },
        {
          title: "Caesar Salad Chicken",
          description:
            "Classic Caesar salad with grilled chicken, croutons, and Parmesan cheese.",
          price: "$200",
          originalPrice: "$350",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752130270/menu11_yizlj0.webp",
          hasOrderButton: true,
        },
        {
          title: "Mediterranean Quinoa Salad",
          description:
            "A hearty and healthy salad with quinoa, olives, feta, and sun-dried tomatoes.",
          price: "$230",
          originalPrice: "$420",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752130540/menu12_jowol9.webp",
          hasOrderButton: false,
        },
        {
          title: "Cobb Salad Supreme",
          description:
            "A rich Cobb salad with chicken, bacon, avocado, egg, and blue cheese.",
          price: "$280",
          originalPrice: "$500",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752130540/menu12_jowol9.webp",
          hasOrderButton: false,
        },
      ],
      todaySpecial: {
        text: 'Today<br />special<br /><span class="text-[#FF4C15]">Salad</span>',
        mainImage:
          "https://res.cloudinary.com/dxohwanal/image/upload/v1752130659/menu13_cqriuj.webp",
      },
    },
  },
  {
    label: "APPETIZER",
    itemImage:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1747894100/appetizer_k8n5uw.png",
    mainContent: {
      items: [
        {
          title: "Crispy French Fries",
          description:
            "Golden, crispy, and perfectly salted french fries, a classic appetizer.",
          price: "$80",
          originalPrice: "$150",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
          hasOrderButton: false,
        },
        {
          title: "Onion Rings Sauce",
          description:
            "Sweet and savory onion rings, deep-fried to perfection, served with a special dipping sauce.",
          price: "$100",
          originalPrice: "$180",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
          hasOrderButton: true,
        },
        {
          title: "Mozzarella Sticks",
          description:
            "Warm, gooey mozzarella sticks coated in crispy breading, served with marinara.",
          price: "$120",
          originalPrice: "$200",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
          hasOrderButton: false,
        },
        {
          title: "Garlic Bread with Cheese",
          description:
            "Toasted garlic bread topped with melted cheese, a perfect companion to any meal.",
          price: "$90",
          originalPrice: "$160",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
          hasOrderButton: false,
        },
      ],
      todaySpecial: {
        text: 'Today<br />special<br /><span class="text-[#FF4C15]">Appetizer</span>',
        mainImage:
          "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
      },
    },
  },
  {
    label: "DRINKS",
    itemImage:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1747894070/drinks_lhdlws.png",
    mainContent: {
      items: [
        {
          title: "Classic Coca-Cola",
          description:
            "The refreshing taste of Coca-Cola, perfectly chilled to quench your thirst.",
          price: "$50",
          originalPrice: "$80",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
          hasOrderButton: false,
        },
        {
          title: "Freshly Squeezed Orange Juice",
          description:
            "Natural and invigorating, our freshly squeezed orange juice is a burst of citrus flavor.",
          price: "$100",
          originalPrice: "$120",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
          hasOrderButton: true,
        },
        {
          title: "Creamy Vanilla Milkshake",
          description:
            "Indulge in our rich and creamy vanilla milkshake, a sweet treat for any time.",
          price: "$90",
          originalPrice: "$160",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
          hasOrderButton: false,
        },
        {
          title: "Iced Lemon Tea",
          description:
            "Cool down with our refreshing iced lemon tea, perfectly balanced between sweet and tart.",
          price: "$60",
          originalPrice: "$100",
          image:
            "https://res.cloudinary.com/dxohwanal/image/upload/v1752129320/menu7_worqnh.webp",
          hasOrderButton: false,
        },
      ],
      todaySpecial: {
        text: 'Today<br />special<br /><span class="text-[#FF4C15]">Drinks</span>',
        mainImage:
          "https://res.cloudinary.com/dxohwanal/image/upload/v1752129185/menu6_usoio7.webp",
      },
    },
  },
];

// Same restaurant-hours logic as TopBar/Signature/Deliver — keep in sync if you change one
const KITCHEN_OPEN_HOUR = 10;
const KITCHEN_CLOSE_HOUR = 22;
const CATEGORIES_PER_VIEW = 3;

const slugify = (title: string) => title.toLowerCase().replace(/\s+/g, "-");

const Items = () => {
  const [selected, setSelected] = useState<string>("BURGERS");
  const [startIndex, setStartIndex] = useState<number>(0);
  const [showAllItemsSm, setShowAllItemsSm] = useState<boolean>(false);
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(false);
  const [isKitchenOpen, setIsKitchenOpen] = useState<boolean>(true);
  const { addToCart } = useCart();

  useEffect(() => {
    const checkKitchenStatus = () => {
      const now = new Date();
      const hours = now.getHours();
      setIsKitchenOpen(
        hours >= KITCHEN_OPEN_HOUR && hours < KITCHEN_CLOSE_HOUR,
      );
    };

    checkKitchenStatus();
    const interval = setInterval(checkKitchenStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    setShowAllItemsSm(false);
  }, [selected]);

  const selectedCategoryData = categoryItems.find(
    (item) => item.label === selected,
  );
  if (!selectedCategoryData) {
    return (
      <Container>
        <p className="text-center mt-64 text-red-500" role="alert">
          Category not found.
        </p>
      </Container>
    );
  }

  const { items, todaySpecial } = selectedCategoryData.mainContent;
  const totalCategories = categoryItems.length;

  const handleNextCategories = () => {
    setStartIndex((prev) => (prev + 1) % totalCategories);
  };

  const getVisibleCategories = (): CategoryItem[] => {
    const currentVisible: CategoryItem[] = [];
    for (let i = 0; i < CATEGORIES_PER_VIEW; i++) {
      currentVisible.push(categoryItems[(startIndex + i) % totalCategories]);
    }
    return currentVisible;
  };
  const visibleCategories = getVisibleCategories();

  const displayedItems = isSmallScreen
    ? showAllItemsSm
      ? items
      : items.slice(0, 2)
    : items;

  const showToggleButtonSm = items.length > 2 && isSmallScreen;
  const toggleShowAllItemsSm = () => setShowAllItemsSm((prev) => !prev);

  const handleOrderNow = (item: MenuItem) => {
    if (!isKitchenOpen) {
      toast.error("Kitchen is currently closed! Try again later.");
      return;
    }

    addToCart({
      id: slugify(item.title),
      title: item.title,
      price: parseFloat(item.price.replace("$", "")),
      quantity: 1,
      imageUrl: item.image,
    });

    toast.success(`${item.title.replace(/<[^>]+>/g, "")} added to cart!`);
  };

  return (
    <Container>
      <section
        aria-label="Food Categories Navigation and Menu Items"
        className="3xl:mt-32 2xl:mt-28 xl:mt-20 lg:mt-6 md:mt-6 sm:mt-4 3xl:ml-[4rem] 3xl:mr-12 2xl:ml-4 2xl:mr-10 xl:ml-14 xl:mr-12 lg:-ml-3 lg:mr-16 md:-ml-12 md:mr-4 sm:-ml-[7rem] sm:mr-0 overflow-hidden"
      >
        {/* Category Navigation */}
        <nav
          aria-label="Food categories"
          className="bg-[#2C6252] py-8 flex justify-center px-4 relative"
        >
          {/* Desktop categories */}
          <div className="hidden lg:flex 3xl:space-x-24 2xl:space-x-20 xl:space-x-20 lg:space-x-16">
            {categoryItems.map((item) => (
              <Motion.button
                key={item.label}
                onClick={() => setSelected(item.label)}
                className="flex flex-col items-center cursor-pointer relative bg-transparent border-none outline-none"
                aria-current={selected === item.label ? "true" : "false"}
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
                type="button"
              >
                <Motion.img
                  src={item.itemImage}
                  alt={`${item.label} category icon`}
                  className="3xl:w-14 3xl:h-14 2xl:w-14 2xl:h-14 xl:w-14 xl:h-14 lg:w-12 lg:h-12 md:w-10 md:h-10 sm:w-6 sm:h-6"
                  initial={{ rotate: 0 }}
                  whileHover={{ rotate: 10 }}
                  transition={{ type: "spring", stiffness: 200 }}
                />
                <span
                  className={`mt-4 text-xs font-semibold ${selected === item.label ? "text-white" : "text-[#138261]"}`}
                >
                  {item.label}
                </span>
                {selected === item.label && (
                  <div
                    className="absolute bottom-0 w-full h-1 -mb-4"
                    aria-hidden="true"
                  />
                )}
              </Motion.button>
            ))}
          </div>

          {/* Mobile/Tablet categories */}
          <div className="flex lg:hidden sm:w-44 md:w-full justify-between items-center relative">
            {visibleCategories.map((item) => (
              <Motion.button
                key={item.label}
                onClick={() => setSelected(item.label)}
                className="flex flex-col items-center cursor-pointer relative bg-transparent border-none outline-none flex-1"
                aria-current={selected === item.label ? "true" : "false"}
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
                type="button"
              >
                <Motion.img
                  src={item.itemImage}
                  alt={`${item.label} category icon`}
                  className="md:w-10 md:h-10 sm:w-6 sm:h-6"
                  initial={{ rotate: 0 }}
                  whileHover={{ rotate: 10 }}
                  transition={{ type: "spring", stiffness: 200 }}
                />
                <span
                  className={`mt-4 sm:text-[8px] md:text-[10px] font-semibold ${
                    selected === item.label ? "text-white" : "text-[#138261]"
                  }`}
                >
                  {item.label}
                </span>
                {selected === item.label && (
                  <div
                    className="absolute bottom-0 w-full h-1 -mb-4"
                    aria-hidden="true"
                  />
                )}
              </Motion.button>
            ))}
            {totalCategories > CATEGORIES_PER_VIEW && (
              <button
                onClick={handleNextCategories}
                className="absolute sm:-right-9 md:right-2 bg-transparent border-none outline-none cursor-pointer p-2 rounded-full md:top-3 sm:top-0 z-10"
                aria-label="Next categories"
                type="button"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        </nav>

        {/* Main Content */}
        <div className="bg-white py-12 px-4 3xl:px-0 2xl:px-14 xl:px-14 lg:px-14 md:px-14 sm:px-14 grid grid-cols-1 lg:grid-cols-3 gap-10 mt-10">
          {/* Today Special (mobile/tablet) */}
          <aside className="lg:hidden bg-white text-[#2C6252] p-6 relative overflow-hidden flex flex-col justify-start items-center text-center md:mt-0 sm:-mt-16 col-span-full">
            <Motion.h3
              className="md:text-5xl sm:text-2xl font-bold sm:leading-snug md:leading-normal mt-10"
              dangerouslySetInnerHTML={{ __html: todaySpecial.text }}
            />
            <Motion.div
              className="relative w-full"
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={todaySpecial.mainImage}
                alt={`${selected} today special`}
                className="mt-8 w-full h-auto object-contain md:w-3/4 mx-auto"
              />
            </Motion.div>
          </aside>

          {/* Menu Items */}
          <section className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-12 lg:-ml-16 3xl:-ml-0">
            {displayedItems.map((item, index) => (
              <article
                key={index}
                className="bg-[#F8F8F8] 3xl:p-12 2xl:p-12 xl:p-12 lg:p-10 md:p-10 sm:p-10 flex flex-col items-start h-96"
              >
                <h2
                  dangerouslySetInnerHTML={{ __html: item.title }}
                  className="3xl:text-lg 2xl:text-lg xl:text-lg md:text-lg sm:text-sm font-semibold text-[#2C6252]"
                />
                <p className="text-gray-500 3xl:text-sm 2xl:text-sm xl:text-sm md:text-sm sm:text-xs mt-4 mb-4">
                  {item.description}
                </p>
                <div className="flex sm:flex-col md:flex-row items-center md:justify-between w-full mt-auto">
                  <Motion.img
                    src={item.image}
                    alt={`${item.title} image`}
                    className="w-40 h-auto object-contain -ml-4"
                    animate={selected === "PIZZA" ? { rotate: 360 } : {}}
                    transition={
                      selected === "PIZZA"
                        ? { repeat: Infinity, duration: 10, ease: "linear" }
                        : { type: "spring", stiffness: 100 }
                    }
                  />
                  <div className="flex flex-col sm:items-center md:items-end">
                    <div className="flex items-end gap-x-1 sm:mt-2 md:mt-0">
                      <div className="3xl:text-2xl 2xl:text-2xl xl:text-2xl lg:text-lg md:text-lg sm:text-sm font-bold text-[#2C6252] leading-none">
                        {item.price}
                      </div>
                      <span className="3xl:text-base 2xl:text-base xl:text-base lg:text-sm md:text-sm sm:text-sm line-through text-[#FF4C15] md:relative md:top-4 font-bold">
                        {item.originalPrice}
                      </span>
                    </div>
                    {item.hasOrderButton && (
                      <div className="relative inline-block group w-max md:top-8 sm:mt-2">
                        <Motion.button
                          disabled={!isKitchenOpen}
                          className={`text-white text-xs sm:text-sm font-bold px-3 py-2 whitespace-nowrap rounded-sm w-full ${
                            isKitchenOpen
                              ? "bg-[#FF4C15] cursor-pointer hover:bg-orange-600"
                              : "bg-gray-400 cursor-not-allowed text-gray-200 text-sm sm:text-base"
                          }`}
                          whileTap={isKitchenOpen ? { scale: 0.95 } : {}}
                          onClick={() => handleOrderNow(item)}
                          aria-label={
                            isKitchenOpen
                              ? `Order now: ${item.title}`
                              : `${item.title} unavailable`
                          }
                          type="button"
                        >
                          {isKitchenOpen ? "Order Now" : "Unavailable"}
                        </Motion.button>

                        {!isKitchenOpen && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-center text-[10px] sm:text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-sm whitespace-nowrap">
                            Kitchen will open at {KITCHEN_OPEN_HOUR} AM
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}

            {/* Show More/Less button */}
            {showToggleButtonSm && (
              <div className="flex justify-center col-span-full">
                <button
                  onClick={toggleShowAllItemsSm}
                  className="bg-white text-[#2C6252] p-3 rounded-full shadow-lg"
                  aria-label={
                    showAllItemsSm
                      ? "Show less menu items"
                      : "Show more menu items"
                  }
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    {showAllItemsSm ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    )}
                  </svg>
                </button>
              </div>
            )}
          </section>

          {/* Today Special (desktop) */}
          <aside className="hidden lg:flex bg-white text-[#2C6252] p-6 relative overflow-hidden flex-col justify-start items-center text-center sm:top-24 md:top-24 lg:top-24 xl:top-36 2xl:top-20 3xl:top-10 3xl:left-0">
            <Motion.h3
              className="3xl:text-7xl 2xl:text-6xl xl:text-5xl lg:text-4xl md:text-4xl sm:text-4xl font-bold mt-10"
              dangerouslySetInnerHTML={{ __html: todaySpecial.text }}
            />
            <Motion.div
              className="relative w-full"
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={todaySpecial.mainImage}
                alt={`${selected} today special`}
                className="mt-8 w-full h-auto object-contain md:w-3/4 mx-auto"
              />
            </Motion.div>
          </aside>
        </div>
      </section>
    </Container>
  );
};

export default Items;
