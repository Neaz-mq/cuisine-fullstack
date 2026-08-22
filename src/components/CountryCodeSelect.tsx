"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Flags from "country-flag-icons/react/3x2";

export type Country = {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dial: string; // + সহ
};

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan", dial: "+93" },
  { code: "AL", name: "Albania", dial: "+355" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "AD", name: "Andorra", dial: "+376" },
  { code: "AO", name: "Angola", dial: "+244" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "AM", name: "Armenia", dial: "+374" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "AT", name: "Austria", dial: "+43" },
  { code: "AZ", name: "Azerbaijan", dial: "+994" },
  { code: "BH", name: "Bahrain", dial: "+973" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
  { code: "BY", name: "Belarus", dial: "+375" },
  { code: "BE", name: "Belgium", dial: "+32" },
  { code: "BT", name: "Bhutan", dial: "+975" },
  { code: "BO", name: "Bolivia", dial: "+591" },
  { code: "BA", name: "Bosnia and Herzegovina", dial: "+387" },
  { code: "BW", name: "Botswana", dial: "+267" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "BN", name: "Brunei", dial: "+673" },
  { code: "BG", name: "Bulgaria", dial: "+359" },
  { code: "KH", name: "Cambodia", dial: "+855" },
  { code: "CM", name: "Cameroon", dial: "+237" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "CR", name: "Costa Rica", dial: "+506" },
  { code: "HR", name: "Croatia", dial: "+385" },
  { code: "CU", name: "Cuba", dial: "+53" },
  { code: "CY", name: "Cyprus", dial: "+357" },
  { code: "CZ", name: "Czechia", dial: "+420" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "EC", name: "Ecuador", dial: "+593" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "SV", name: "El Salvador", dial: "+503" },
  { code: "EE", name: "Estonia", dial: "+372" },
  { code: "ET", name: "Ethiopia", dial: "+251" },
  { code: "FJ", name: "Fiji", dial: "+679" },
  { code: "FI", name: "Finland", dial: "+358" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "GE", name: "Georgia", dial: "+995" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "GR", name: "Greece", dial: "+30" },
  { code: "GT", name: "Guatemala", dial: "+502" },
  { code: "HN", name: "Honduras", dial: "+504" },
  { code: "HK", name: "Hong Kong", dial: "+852" },
  { code: "HU", name: "Hungary", dial: "+36" },
  { code: "IS", name: "Iceland", dial: "+354" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "ID", name: "Indonesia", dial: "+62" },
  { code: "IR", name: "Iran", dial: "+98" },
  { code: "IQ", name: "Iraq", dial: "+964" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "IL", name: "Israel", dial: "+972" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "JM", name: "Jamaica", dial: "+1876" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "JO", name: "Jordan", dial: "+962" },
  { code: "KZ", name: "Kazakhstan", dial: "+7" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "KW", name: "Kuwait", dial: "+965" },
  { code: "KG", name: "Kyrgyzstan", dial: "+996" },
  { code: "LA", name: "Laos", dial: "+856" },
  { code: "LV", name: "Latvia", dial: "+371" },
  { code: "LB", name: "Lebanon", dial: "+961" },
  { code: "LY", name: "Libya", dial: "+218" },
  { code: "LT", name: "Lithuania", dial: "+370" },
  { code: "LU", name: "Luxembourg", dial: "+352" },
  { code: "MO", name: "Macau", dial: "+853" },
  { code: "MG", name: "Madagascar", dial: "+261" },
  { code: "MW", name: "Malawi", dial: "+265" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "MV", name: "Maldives", dial: "+960" },
  { code: "MT", name: "Malta", dial: "+356" },
  { code: "MU", name: "Mauritius", dial: "+230" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "MD", name: "Moldova", dial: "+373" },
  { code: "MC", name: "Monaco", dial: "+377" },
  { code: "MN", name: "Mongolia", dial: "+976" },
  { code: "ME", name: "Montenegro", dial: "+382" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "MZ", name: "Mozambique", dial: "+258" },
  { code: "MM", name: "Myanmar", dial: "+95" },
  { code: "NA", name: "Namibia", dial: "+264" },
  { code: "NP", name: "Nepal", dial: "+977" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "NI", name: "Nicaragua", dial: "+505" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "KP", name: "North Korea", dial: "+850" },
  { code: "MK", name: "North Macedonia", dial: "+389" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "OM", name: "Oman", dial: "+968" },
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "PS", name: "Palestine", dial: "+970" },
  { code: "PA", name: "Panama", dial: "+507" },
  { code: "PG", name: "Papua New Guinea", dial: "+675" },
  { code: "PY", name: "Paraguay", dial: "+595" },
  { code: "PE", name: "Peru", dial: "+51" },
  { code: "PH", name: "Philippines", dial: "+63" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "RO", name: "Romania", dial: "+40" },
  { code: "RU", name: "Russia", dial: "+7" },
  { code: "RW", name: "Rwanda", dial: "+250" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "SN", name: "Senegal", dial: "+221" },
  { code: "RS", name: "Serbia", dial: "+381" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "SK", name: "Slovakia", dial: "+421" },
  { code: "SI", name: "Slovenia", dial: "+386" },
  { code: "SO", name: "Somalia", dial: "+252" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "KR", name: "South Korea", dial: "+82" },
  { code: "SS", name: "South Sudan", dial: "+211" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "LK", name: "Sri Lanka", dial: "+94" },
  { code: "SD", name: "Sudan", dial: "+249" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "SY", name: "Syria", dial: "+963" },
  { code: "TW", name: "Taiwan", dial: "+886" },
  { code: "TJ", name: "Tajikistan", dial: "+992" },
  { code: "TZ", name: "Tanzania", dial: "+255" },
  { code: "TH", name: "Thailand", dial: "+66" },
  { code: "TN", name: "Tunisia", dial: "+216" },
  { code: "TR", name: "Türkiye", dial: "+90" },
  { code: "TM", name: "Turkmenistan", dial: "+993" },
  { code: "UG", name: "Uganda", dial: "+256" },
  { code: "UA", name: "Ukraine", dial: "+380" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "UY", name: "Uruguay", dial: "+598" },
  { code: "UZ", name: "Uzbekistan", dial: "+998" },
  { code: "VE", name: "Venezuela", dial: "+58" },
  { code: "VN", name: "Vietnam", dial: "+84" },
  { code: "YE", name: "Yemen", dial: "+967" },
  { code: "ZM", name: "Zambia", dial: "+260" },
  { code: "ZW", name: "Zimbabwe", dial: "+263" },
];

export const DEFAULT_COUNTRY =
  COUNTRIES.find((c) => c.code === "BD") ?? COUNTRIES[0];

// country-flag-icons প্রতিটি দেশের জন্য ISO code নামে একটি React component export
// করে (Flags.BD, Flags.US ...)। namespace import-টি ঠিকভাবে index করার জন্য cast।
type FlagComponent = React.ComponentType<{
  title?: string;
  className?: string;
}>;
const FLAG_COMPONENTS = Flags as unknown as Record<string, FlagComponent>;

/**
 * পতাকা — inline SVG, কোনো network request নেই।
 *
 * flagcdn.com ব্যবহার করা হয়নি: next.config.ts-এর CSP `img-src`-এ ওই origin
 * নেই, তাই browser প্রতিটি পতাকা block করত। Emoji পতাকাও নয়, কারণ Windows-এ
 * Chrome/Edge সেগুলো render না করে শুধু "BD", "AF" অক্ষর দেখায়।
 *
 * 3x2 aspect ratio, তাই 21×14। ring দিয়ে জাপান/পোল্যান্ডের মতো সাদা-প্রধান
 * পতাকাও সাদা background-এ আলাদা করে বোঝা যায়।
 */
function Flag({ code, name }: { code: string; name: string }) {
  const FlagIcon = FLAG_COMPONENTS[code.toUpperCase()];

  // অজানা code এলে fallback: ISO অক্ষর
  if (!FlagIcon) {
    return (
      <span className="w-[21px] h-[14px] shrink-0 rounded-[2px] bg-black/10 flex items-center justify-center text-[8px] font-semibold text-black/50">
        {code}
      </span>
    );
  }

  return (
    <FlagIcon
      title={name}
      className="w-[21px] h-[14px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
    />
  );
}

type Props = {
  value: Country;
  onChange: (country: Country) => void;
};

export default function CountryCodeSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // নাম, dial code, বা ISO code — তিনটার যেকোনো একটা দিয়ে খোঁজা যায়
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [query]);

  /**
   * খোলার সময়কার state reset এখানেই হয়, কোনো effect-এ নয়।
   *
   * এগুলো "open হয়ে গেছে" — এই অবস্থার সাথে কিছু sync করা নয়, বরং user-এর
   * একটা কাজের সরাসরি ফল। Effect-এ setState ডাকলে React প্রথমে পুরোনো
   * query/activeIndex নিয়ে render করে, তারপর আবার render করে — cascading
   * render, যেটা react-hooks/set-state-in-effect ধরে ফেলে। তিনটে setState
   * এক event handler-এ থাকায় React সেগুলো batch করে একটাই render দেয়।
   */
  const openDropdown = () => {
    setQuery("");
    // নির্বাচিত দেশটি থেকেই highlight শুরু হয়
    const idx = COUNTRIES.findIndex((c) => c.code === value.code);
    setActiveIndex(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const closeDropdown = () => setOpen(false);

  // বাইরে click করলে বন্ধ
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Focus সরানো — DOM API, state নয়, তাই effect-এই থাকার কথা।
  // Effect DOM commit-এর পরে চলে, তাই ref ততক্ষণে set হয়ে গেছে।
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);

  // keyboard দিয়ে navigate করলে active item দৃশ্যমান রাখা — এটাও DOM API
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // বন্ধ অবস্থায় ↓ চাপলে খুলবে; বাকি key তখন উপেক্ষা করা হয়, নাহলে
    // অদৃশ্য list-এর activeIndex বদলাতে থাকত।
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = filtered[activeIndex];
      if (picked) {
        onChange(picked);
        closeDropdown();
      }
    }
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${value.name} ${value.dial}`}
        className="h-full flex items-center gap-2 px-3 sm:px-3.5 border-r border-black/10 text-[14px] sm:text-[15px] text-black/80 hover:bg-black/[0.03] transition-colors focus:outline-none focus-visible:bg-black/[0.05]"
      >
        <Flag code={value.code} name={value.name} />
        <span className="whitespace-nowrap">{value.dial}</span>
        <svg
          className={`w-3.5 h-3.5 text-black/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-[calc(100%+6px)] left-0 w-[280px] max-w-[calc(100vw-48px)] bg-white rounded-xl border border-black/10 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-black/5">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search country or code"
              aria-label="Search country or dial code"
              className="w-full h-9 px-3 rounded-lg bg-[#F9F6F3] text-[14px] text-black placeholder-black/35 focus:outline-none focus:ring-2 focus:ring-[#2C6252]/30"
            />
          </div>

          <ul
            ref={listRef}
            role="listbox"
            className="max-h-[240px] overflow-y-auto overscroll-contain py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-[13px] text-black/50 text-center">
                No country found
              </li>
            )}
            {filtered.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === value.code}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(c);
                  closeDropdown();
                }}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-[14px] ${
                  i === activeIndex ? "bg-[#F9F6F3]" : ""
                } ${c.code === value.code ? "font-semibold" : ""}`}
              >
                <Flag code={c.code} name={c.name} />
                <span className="min-w-0 flex-1 truncate text-black">
                  {c.name}
                </span>
                <span className="shrink-0 text-black/50">{c.dial}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}