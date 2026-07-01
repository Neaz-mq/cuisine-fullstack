"use client";

import { useEffect, useState } from "react";
import Container from "@/components/Container";
import { useCart } from "@/context/CartContext";
import Select, { SingleValue } from "react-select";
import { toast } from "react-toastify";
import { COUNTRY_OPTIONS, type CountryOption } from "@/data/countries";

interface BillingFormData {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  phoneNumber: string;
}

interface CardDetails {
  cardholderName: string;
  cardNumber: string;
  expiryDate: string;
  ccv: string;
}

type BillingErrors = Partial<Record<keyof BillingFormData | "selectedCountry", string>>;
type PaymentErrors = Partial<Record<keyof CardDetails | "isAgreedToTerms", string>>;

const Carts = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { cartItems, increaseQty, decreaseQty, removeFromCart, clearCart } = useCart();
  const [selectedShipping, setSelectedShipping] = useState("uber-eats");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [formData, setFormData] = useState<BillingFormData>({
    email: "",
    firstName: "",
    lastName: "",
    address: "",
    apartment: "",
    city: "",
    state: "",
    zip: "",
    phoneNumber: "",
  });

  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardholderName: "",
    cardNumber: "",
    expiryDate: "",
    ccv: "",
  });

  const [isAgreedToTerms, setIsAgreedToTerms] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [errors, setErrors] = useState<BillingErrors>({});
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal;

  const handleConfirmOrder = () => {
    if (cartItems.length === 0) {
      toast.warning("Please add an item before placing the order!", {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    const newErrors: BillingErrors = {};
    const newPaymentErrors: PaymentErrors = {};

    if (!formData.email.trim()) newErrors.email = "Email is required.";
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required.";
    if (!formData.address.trim()) newErrors.address = "Address is required.";
    if (!formData.city.trim()) newErrors.city = "City is required.";
    if (!formData.state.trim()) newErrors.state = "State is required.";
    if (!formData.zip.trim()) newErrors.zip = "Zip code is required.";
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = "Phone number is required.";
    if (!selectedCountry) newErrors.selectedCountry = "Country is required.";

    if (paymentMethod === "online") {
      if (!cardDetails.cardholderName.trim())
        newPaymentErrors.cardholderName = "Cardholder name is required.";
      if (!cardDetails.cardNumber.trim())
        newPaymentErrors.cardNumber = "Card number is required.";
      if (!/^\d{16}$/.test(cardDetails.cardNumber.replace(/\s/g, "")))
        newPaymentErrors.cardNumber = "Invalid card number (16 digits required).";
      if (!cardDetails.expiryDate.trim())
        newPaymentErrors.expiryDate = "Expiry date is required.";
      if (!/^\d{2}\/\d{2}$/.test(cardDetails.expiryDate))
        newPaymentErrors.expiryDate = "Invalid expiry date (MM/YY).";
      if (!cardDetails.ccv.trim()) newPaymentErrors.ccv = "CCV is required.";
      if (!/^\d{3,4}$/.test(cardDetails.ccv)) newPaymentErrors.ccv = "Invalid CCV (3 or 4 digits).";
      if (!isAgreedToTerms) newPaymentErrors.isAgreedToTerms = "You must agree to the condition.";
    }

    setErrors(newErrors);
    setPaymentErrors(newPaymentErrors);

    if (Object.keys(newErrors).length === 0 && Object.keys(newPaymentErrors).length === 0) {
      toast.success("The Food order successfully!", {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        address: "",
        apartment: "",
        city: "",
        state: "",
        zip: "",
        phoneNumber: "",
      });
      setSelectedCountry(null);
      setErrors({});

      setCardDetails({
        cardholderName: "",
        cardNumber: "",
        expiryDate: "",
        ccv: "",
      });
      setIsAgreedToTerms(false);
      setPaymentErrors({});

      clearCart();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCardDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleDiscountCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDiscountCode(e.target.value);
  };

  const applyDiscount = () => {
    toast.info(`Discount code "${discountCode}" applied (for demonstration).`, {
      position: "bottom-center",
      autoClose: 2000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  const shippingMethodSection = (
    <div className="space-y-4">
      <h4 className="3xl:text-2xl 2xl:text-2xl xl:text-2xl lg:text-2xl md:text-2xl sm:text-lg font-semibold text-gray-800 mb-2 pt-8">
        Available Shipping Method
      </h4>

      <div className="space-y-4">
        {/* Uber Eats */}
        <label
          className={`flex items-center justify-between border 3xl:px-4 3xl:py-3 2xl:px-4 2xl:py-3 xl:px-4 xl:py-3 lg:px-4 lg:py-3 md:px-4 md:py-3 sm:px-2 sm:py-1 cursor-pointer ${
            selectedShipping === "uber-eats" ? "border-gray-500 bg-gray-50" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751346396/63cecf750aa7463091b17adf_5310366-uber-eats-logo-png-and-vector-logo-download-uber-eats-png-3500_3500_preview_thtrrl.png"
              alt="Uber Eats"
              className="3xl:w-12 3xl:h-12 2xl:w-12 2xl:h-12 xl:w-12 xl:h-12 md:w-12 md:h-12 sm:w-8 sm:h-8"
            />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-800 sm:text-[11px] 3xl:text-[16px] 2xl:text-[16px] xl:text-[16px] lg:text-[16px] md:text-[15px]">
                  Uber eats
                </p>
                <span className="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded-full">
                  Suggested
                </span>
              </div>
              <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-500">
                Delivery time: 20m/35m
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:flex-col 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row text-green-800 font-semibold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs">
            Free
            <input
              type="radio"
              name="shipping"
              value="uber-eats"
              checked={selectedShipping === "uber-eats"}
              onChange={() => setSelectedShipping("uber-eats")}
              className="accent-green-700"
            />
          </div>
        </label>

        {/* Food Panda */}
        <label
          className={`flex items-center justify-between border px-4 py-3 cursor-pointer ${
            selectedShipping === "food-panda" ? "border-gray-500 bg-gray-50" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-4">
            <img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1751346468/Group_973_w3ofel.png"
              alt="Food Panda"
              className="3xl:w-12 3xl:h-12 2xl:w-12 2xl:h-12 xl:w-12 xl:h-12 md:w-12 md:h-12 sm:w-8 sm:h-8"
            />
            <div>
              <p className="font-semibold text-gray-800 sm:text-[11px] 3xl:text-[16px] 2xl:text-[16px] xl:text-[16px] lg:text-[16px] md:text-[15px]">
                Food panda
              </p>
              <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-500">
                Delivery time: 1h/1.35h
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:flex-col 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row text-green-800 font-semibold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs">
            Free
            <input
              type="radio"
              name="shipping"
              value="food-panda"
              checked={selectedShipping === "food-panda"}
              onChange={() => setSelectedShipping("food-panda")}
              className="accent-green-700"
            />
          </div>
        </label>
      </div>
    </div>
  );

  const paymentMethodSection = (
    <>
      <div className="space-y-4">
        <h4 className="3xl:text-2xl 2xl:text-2xl xl:text-2xl lg:text-2xl md:text-2xl sm:text-lg font-semibold text-gray-800 mb-2 pt-8">
          Payment Method
        </h4>
        <div className="space-y-3 bg-gray-50 p-4 rounded-md">
          {/* Online Payment */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="payment"
              value="online"
              checked={paymentMethod === "online"}
              onChange={() => setPaymentMethod("online")}
              className="hidden"
            />
            <span
              className={`w-5 h-5 mt-1 inline-block rounded-full border-2 border-gray-400 flex-shrink-0 ${
                paymentMethod === "online" ? "bg-[#2C6252]" : "bg-white"
              }`}
            ></span>
            <div>
              <p className="font-semibold text-gray-800">Online Payment</p>
              <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-600">
                Pay securely using a card or mobile wallet.
              </p>
            </div>
          </label>

          {/* Cash on Delivery */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="payment"
              value="cod"
              checked={paymentMethod === "cod"}
              onChange={() => setPaymentMethod("cod")}
              className="hidden"
            />
            <span
              className={`w-5 h-5 mt-1 inline-block rounded-full border-2 border-gray-400 flex-shrink-0 ${
                paymentMethod === "cod" ? "bg-[#2C6252]" : "bg-white"
              }`}
            ></span>
            <div>
              <p className="font-semibold text-gray-800">Cash on Delivery</p>
              <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs text-gray-600">
                Pay with cash upon delivery.
              </p>
            </div>
          </label>
        </div>
      </div>

      {paymentMethod === "online" && (
        <div className="mt-8 p-6 border border-gray-200 space-y-4">
          <div className="flex sm:flex-col 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row items-center justify-between">
            <h3 className="3xl:text-xl 2xl:text-xl xl:text-xl lg:text-xl md:text-xl sm:text-lg font-semibold text-gray-800">
              Credit card / debit card
            </h3>
            <div className="flex items-center 3xl:gap-8 2xl:gap-8 xl:gap-8 lg:gap-8 md:gap-8 sm:gap-4 sm:mt-3 sm:-ml-1 3xl:mt-0 3xl:-ml-0 2xl:mt-0 2xl:-ml-0 xl:mt-0 xl:-ml-0 lg:mt-0 lg:-ml-0 md:mt-0 md:-ml-0">
              <img
                src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348676/pngegg_84_rh7u9t.png"
                alt="Mastercard"
                className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6"
              />
              <img
                src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348700/pngegg_85_i6czbr.png"
                alt="Visa"
                className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6"
              />
              <img
                src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348721/pngegg_86_icrxs1.png"
                alt="American Express"
                className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6"
              />
              <img
                src="https://res.cloudinary.com/dxohwanal/image/upload/v1751348785/pngegg_92_lbmpaf.png"
                alt="Ria Money Transfer"
                className="3xl:h-10 2xl:h-10 xl:h-10 lg:h-10 md:h-10 sm:h-6"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="cardholderName" className="block text-sm font-medium text-gray-700">
                Cardholder name
              </label>
              <input
                type="text"
                id="cardholderName"
                name="cardholderName"
                placeholder="Lynette Kunze"
                className="mt-1 block w-full border border-gray-300 px-4 py-2 rounded-md 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                value={cardDetails.cardholderName}
                onChange={handleCardDetailsChange}
              />
              {paymentErrors.cardholderName && (
                <p className="text-red-500 text-xs mt-1">{paymentErrors.cardholderName}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label
                  htmlFor="cardNumber"
                  className="block 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs font-medium text-gray-700"
                >
                  Card number
                </label>
                <input
                  type="text"
                  id="cardNumber"
                  name="cardNumber"
                  placeholder="5316 8e71 7571 5545"
                  className="mt-1 block w-full border border-gray-300 3xl:px-4 3xl:py-2 2xl:px-4 2xl:py-2 xl:px-4 xl:py-2 lg:px-4 lg:py-2 md:px-4 md:py-2 sm:px-2 sm:py-2 rounded-md 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[9px]"
                  value={cardDetails.cardNumber}
                  onChange={handleCardDetailsChange}
                  maxLength={19}
                />
                {paymentErrors.cardNumber && (
                  <p className="text-red-500 text-xs mt-1">{paymentErrors.cardNumber}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="expiryDate"
                  className="block 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs font-medium text-gray-700"
                >
                  Date
                </label>
                <input
                  type="text"
                  id="expiryDate"
                  name="expiryDate"
                  placeholder="24/28"
                  className="mt-1 block w-full border border-gray-300 3xl:px-4 3xl:py-2 2xl:px-4 2xl:py-2 xl:px-4 xl:py-2 lg:px-4 lg:py-2 md:px-4 md:py-2 sm:px-2 sm:py-2 rounded-md 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[9px]"
                  value={cardDetails.expiryDate}
                  onChange={handleCardDetailsChange}
                  maxLength={5}
                />
                {paymentErrors.expiryDate && (
                  <p className="text-red-500 text-xs mt-1">{paymentErrors.expiryDate}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="ccv"
                  className="block 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs font-medium text-gray-700"
                >
                  CCV <span className="text-gray-400 text-sm ml-1">?</span>
                </label>
                <input
                  type="text"
                  id="ccv"
                  name="ccv"
                  placeholder="2659"
                  className="mt-1 block w-full border border-gray-300 3xl:px-4 3xl:py-2 2xl:px-4 2xl:py-2 xl:px-4 xl:py-2 lg:px-4 lg:py-2 md:px-4 md:py-2 sm:px-2 sm:py-2 rounded-md 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[9px]"
                  value={cardDetails.ccv}
                  onChange={handleCardDetailsChange}
                  maxLength={4}
                />
                {paymentErrors.ccv && <p className="text-red-500 text-xs mt-1">{paymentErrors.ccv}</p>}
              </div>
            </div>

            <p className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px] text-gray-500 flex items-center gap-2">
              <span className="text-blue-500 text-lg mr-1">&#9432;</span>
              Credit card payments may take up to 24th to be processed
              <span className="text-gray-400 text-sm ml-1">?</span>
            </p>

            <label className="flex items-center gap-2 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={isAgreedToTerms}
                onChange={(e) => setIsAgreedToTerms(e.target.checked)}
                className="form-checkbox h-4 w-4 text-green-600 rounded"
              />
              <span className="text-gray-700 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px]">
                If you agree this condition please mark
              </span>
            </label>
            {paymentErrors.isAgreedToTerms && (
              <p className="text-red-500 text-xs mt-1">{paymentErrors.isAgreedToTerms}</p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleConfirmOrder}
        className="bg-[#2C6252] text-white w-full py-3 font-semibold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs mt-4"
      >
        Confirm your order
      </button>
    </>
  );

  return (
    <Container>
      <div className="bg-white min-h-screen px-4 py-8 md:px-6 3xl:px-[4.2rem] xl:px-14 lg:px-0 2xl:px-4 3xl:mb-36 2xl:mb-28 xl:mb-28 lg:mb-24 sm:mb-10 lg:-ml-2 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 md:-ml-20 sm:-ml-36 -mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <h3 className="3xl:text-3xl 2xl:text-3xl xl:text-3xl lg:text-3xl md:text-2xl sm:text-lg font-semibold text-gray-800">
                Billing Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <input
                  name="firstName"
                  type="text"
                  placeholder="First name"
                  className="border border-gray-300 px-4 py-2 rounded 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                  value={formData.firstName}
                  onChange={handleChange}
                />
                <input
                  name="lastName"
                  type="text"
                  placeholder="Last name"
                  className="border border-gray-300 px-4 py-2 rounded 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
              {errors.firstName && <p className="text-red-500 text-xs">{errors.firstName}</p>}
              {errors.lastName && <p className="text-red-500 text-xs">{errors.lastName}</p>}

              <Select<CountryOption>
                inputId="country-select"
                instanceId="country-select"
                options={COUNTRY_OPTIONS}
                value={selectedCountry}
                onChange={(option: SingleValue<CountryOption>) => setSelectedCountry(option)}
                placeholder="Select country"
                styles={{
                  menuList: (base) => ({ ...base, maxHeight: 220 }),
                  control: (base) => ({
                    ...base,
                    borderColor: "#d1d5db",
                    minHeight: "38px",
                    fontSize: "0.875rem",
                  }),
                }}
              />
              {errors.selectedCountry && (
                <p className="text-red-500 text-xs">{errors.selectedCountry}</p>
              )}

              <input
                name="address"
                type="text"
                placeholder="Address line 1 and 2 example"
                className="w-full border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                value={formData.address}
                onChange={handleChange}
              />
              {errors.address && <p className="text-red-500 text-xs">{errors.address}</p>}

              <input
                name="apartment"
                type="text"
                placeholder="Apartment suite etc (optional)"
                className="w-full border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                value={formData.apartment}
                onChange={handleChange}
              />

              <div className="grid grid-cols-3 gap-4">
                <input
                  name="city"
                  type="text"
                  placeholder="City"
                  className="border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px]"
                  value={formData.city}
                  onChange={handleChange}
                />
                <input
                  name="state"
                  type="text"
                  placeholder="State"
                  className="border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px]"
                  value={formData.state}
                  onChange={handleChange}
                />
                <input
                  name="zip"
                  type="text"
                  placeholder="Zip"
                  className="border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px]"
                  value={formData.zip}
                  onChange={handleChange}
                />
              </div>
              {errors.city && <p className="text-red-500 text-xs">{errors.city}</p>}
              {errors.state && <p className="text-red-500 text-xs">{errors.state}</p>}
              {errors.zip && <p className="text-red-500 text-xs">{errors.zip}</p>}

              <input
                type="email"
                name="email"
                placeholder="Email address"
                className="w-full border border-gray-300 px-4 py-2 rounded 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}

              <input
                name="phoneNumber"
                type="text"
                placeholder="Phone number"
                className="w-full border border-gray-300 px-4 py-2 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                value={formData.phoneNumber}
                onChange={handleChange}
              />
              {errors.phoneNumber && <p className="text-red-500 text-xs">{errors.phoneNumber}</p>}

              <div className="hidden lg:block">
                {shippingMethodSection}
                {paymentMethodSection}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="bg-gray-50 p-6 border border-gray-200 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Order summary</h3>
            <div className="space-y-4">
              {cartItems.length === 0 ? (
                <p className="text-sm text-gray-500">Your cart is empty.</p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex items-start sm:gap-2 md:gap-4 3xl:gap-4 2xl:gap-4 xl:gap-4 lg:gap-4">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="3xl:w-16 3xl:h-16 2xl:w-16 2xl:h-16 xl:w-16 xl:h-16 lg:w-16 lg:h-16 md:w-16 md:h-16 sm:w-10 sm:h-10 object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[10px] text-gray-800">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="3xl:text-xs 2xl:text-xs xl:text-xs lg:text-xs md:text-xs sm:text-[7px] text-gray-500">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center mt-2 space-x-2">
                        <button
                          onClick={() => decreaseQty(item.id)}
                          className="bg-gray-200 px-2 py-1 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                        >
                          −
                        </button>
                        <span className="text-sm">{item.quantity}</span>
                        <button
                          onClick={() => increaseQty(item.id)}
                          className="bg-gray-200 px-2 py-1 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="sm:flex sm:flex-col sm:items-end 3xl:flex-row 2xl:flex-row xl:flex-row lg:flex-row md:flex-row items-center">
                      <div className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs font-semibold text-gray-800 whitespace-nowrap">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="ml-2 text-red-600 hover:text-red-800 font-bold 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-xs"
                        aria-label={`Remove ${item.title} from cart`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-10 border-t border-gray-200">
              <div className="flex mb-10">
                <input
                  type="text"
                  placeholder="Gift card or discount code"
                  className="flex-1 border border-gray-300 3xl:px-4 2xl:px-4 xl:px-2 lg:px-2 py-2 md:px-2 sm:px-2 3xl:text-sm 2xl:text-sm xl:text-[12px] lg:text-[11px] md:text-[11px] sm:text-[8px] focus:outline-none focus:ring-1 focus:ring-gray-400"
                  value={discountCode}
                  onChange={handleDiscountCodeChange}
                />
                <button
                  onClick={applyDiscount}
                  className="bg-gray-400 text-white 3xl:px-6 2xl:px-6 xl:px-2 lg:px-2 md:px-2 sm:px-2 py-2 font-semibold 3xl:text-sm 2xl:text-sm xl:text-[12px] lg:text-[11px] md:text-[11px] sm:text-[8px] hover:bg-gray-500 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
            <div className="space-y-10 bg-white p-6">
              <div className="3xl:text-sm 2xl:text-sm xl:text-sm lg:text-sm md:text-sm sm:text-[11px] text-gray-700 space-y-5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>$0</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery charges</span>
                  <span className="text-[#2C6252]">Free</span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 my-4"></div>
              <div className="flex justify-between 3xl:text-md 2xl:text-md xl:text-md lg:text-md md:text-md sm:text-xs font-bold pt-2">
                <span>Total</span>
                <span className="text-[#2C6252]">USD ${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="block lg:hidden">
            {shippingMethodSection}
            {paymentMethodSection}
          </div>
        </div>
      </div>
    </Container>
  );
};

export default Carts;