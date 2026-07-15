"use client";

import { useEffect, useState } from "react";
import { motion as Motion, type Variants } from "framer-motion";
import Container from "@/components/Container";
import { toast } from "react-toastify";
import Select, { SingleValue } from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface ApiTable {
  id: string;
  label: string;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  // null  -> no date/time selected yet, so availability is unknown
  // true  -> this table is free at the selected time
  // false -> this table is already booked at that time
  available: boolean | null;
}

interface TableOption {
  value: string; // RestaurantTable.id
  label: string;
}

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.4, 0, 0.2, 1] },
  }),
};

const tableContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};

const tableItem: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
};

const inputField: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  }),
};

const Reserve = () => {
  const [tables, setTables] = useState<ApiTable[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedTable, setSelectedTable] = useState<TableOption | null>(null);
  const [guestCount, setGuestCount] = useState("");
  const [reservationDate, setReservationDate] = useState<Date | null>(null);

  // Refetch availability whenever reservationDate changes (from the date/time
  // picker). If no date is selected yet, we still fetch the table list so
  // label/capacity are visible, but "available" stays null (unknown).
  useEffect(() => {
    const controller = new AbortController();

    const fetchTables = async () => {
      setIsLoadingTables(true);
      try {
        const url = reservationDate
          ? `/api/tables?reservedAt=${encodeURIComponent(reservationDate.toISOString())}`
          : "/api/tables";

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load tables");

        const data: ApiTable[] = await res.json();
        setTables(data);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error fetching tables:", error);
          toast.error("Failed to load tables. Please refresh and try again.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingTables(false);
      }
    };

    fetchTables();
    return () => controller.abort();
  }, [reservationDate]);

  const hasSelectedDate = reservationDate !== null;

  const tableOptions: TableOption[] = tables
    .filter((table) => table.available !== false)
    .map((table) => ({
      value: table.id,
      label: `${table.label} (${table.capacity} seats)`,
    }));

  const handleBookTable = async () => {
    if (!name || !phone || !selectedTable || !guestCount || !reservationDate) {
      toast.error("Please fill in all fields to reserve a table.");
      return;
    }

    const selectedTableData = tables.find((t) => t.id === selectedTable.value);
    if (selectedTableData && Number(guestCount) > selectedTableData.capacity) {
      toast.error(`This table can seat a maximum of ${selectedTableData.capacity} guests.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable.value,
          customerName: name,
          phone,
          guestCount: Number(guestCount),
          reservedAt: reservationDate.toISOString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 409 = someone else already booked this table for that time (race condition)
        toast.error(data.error || "Failed to create reservation.");
        return;
      }

      const formattedDate = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(reservationDate);

      toast.success(`Table ${data.table.label} has been booked on ${formattedDate}!`);

      setName("");
      setPhone("");
      setGuestCount("");
      setReservationDate(null); // this triggers the useEffect and refreshes the grid
      setSelectedTable(null);
    } catch (error) {
      console.error("Error creating reservation:", error);
      toast.error("Failed to create reservation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      const newDate = new Date(date);
      if (newDate.getHours() === 0 && newDate.getMinutes() === 0 && newDate.getSeconds() === 0) {
        newDate.setHours(11);
      }
      setReservationDate(newDate);
    } else {
      setReservationDate(null);
    }
    // Previously selected table may no longer be valid after picking a new time
    setSelectedTable(null);
  };

  const handleTableSelect = (option: SingleValue<TableOption>) => {
    setSelectedTable(option);
  };

  return (
    <Container>
      <Motion.section
        className="3xl:px-16 2xl:px-5 xl:px-14 lg:px-2 md:px-4 md:-ml-24 mb-24 -mt-14 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-0 sm:-ml-28"
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        aria-labelledby="reservation-heading"
      >
        {/* Header */}
        <Motion.header className="text-center lg:text-left mb-10 mt-20" variants={fadeInUp} custom={1}>
          <h2
            id="reservation-heading"
            className="text-2xl 3xl:text-4xl 2xl:text-4xl xl:text-4xl lg:text-4xl md:text-xl sm:text-xl font-bold text-[#2C6252] leading-relaxed"
          >
            Know which tables are available <br className="hidden lg:block" />
            <span className="text-[#FF4C15] font-semibold">or reserved at a glance</span>
            <Motion.img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1750157744/Mask_Group_50_s7vgxe.png"
              alt="Stylized restaurant table illustration"
              className="inline-block 3xl:w-24 3xl:h-8 2xl:w-24 2xl:h-8 xl:w-24 xl:h-8 lg:w-24 lg:h-8 md:w-24 md:h-8 sm:w-14 sm:h-6 ml-2 align-middle"
              animate={{ y: [0, -8, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity }}
            />
          </h2>
          {!hasSelectedDate && (
            <p className="text-sm text-[#A9A2A2] mt-2">
              Pick a date and time below to see which tables are free, shown in color.
            </p>
          )}
        </Motion.header>

        {/* Table Grid */}
        <Motion.div
          className="grid grid-cols-5 3xl:gap-y-12 2xl:gap-y-12 xl:gap-y-12 lg:gap-y-12 md:gap-y-12 sm:gap-y-8"
          variants={tableContainer}
          initial="hidden"
          animate="visible"
          aria-label="Table Availability Grid"
        >
          {tables.map((table) => {
            const isBooked = table.available === false;
            const isUnknown = table.available === null;
            const bgClass = isUnknown
              ? "bg-gray-300"
              : isBooked
              ? "bg-[#FF4C15]"
              : "bg-[#2C6252]";
            const statusLabel = isUnknown ? "unknown (pick a date)" : isBooked ? "booked" : "available";

            return (
              <Motion.div
                key={table.id}
                className={`cursor-pointer flex items-center justify-center font-bold text-white 3xl:text-6xl 2xl:text-6xl xl:text-5xl lg:text-4xl ${bgClass} 3xl:w-44 3xl:h-44 2xl:w-44 2xl:h-44 xl:w-40 xl:h-40 lg:w-28 lg:h-28`}
                variants={tableItem}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={`Table ${table.label} is ${statusLabel}`}
              >
                {table.label}
              </Motion.div>
            );
          })}
          {isLoadingTables && tables.length === 0 && (
            <p className="col-span-5 text-sm text-[#A9A2A2]">Loading tables...</p>
          )}
        </Motion.div>

        {/* Legend */}
        <Motion.div
          className="flex flex-wrap items-center justify-start gap-8 3xl:mt-28 2xl:mt-28 xl:mt-28 md:mt-28 sm:mt-20"
          variants={fadeInUp}
          custom={2}
          role="note"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#2C6252]" aria-hidden="true"></div>
            <span className="text-[#A9A2A2] text-sm">Free Table Indicator</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FF4C15]" aria-hidden="true"></div>
            <span className="text-[#A9A2A2] text-sm">Booked Table Indicator</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-300" aria-hidden="true"></div>
            <span className="text-[#A9A2A2] text-sm">Unknown (no date picked)</span>
          </div>
        </Motion.div>

        {/* Booking Form */}
        <Motion.div
          className="mt-20 p-6 bg-white max-w-xl mx-auto border border-gray-200"
          variants={fadeInUp}
          custom={3}
          role="form"
          aria-label="Reservation Booking Form"
        >
          <h3 className="3xl:text-2xl 2xl:text-2xl xl:text-2xl md:text-2xl sm:text-xl font-semibold text-center text-[#2C6252] mb-6">
            Book a Table
          </h3>
          <form className="flex flex-col gap-4">
            <Motion.input
              id="name"
              type="text"
              placeholder="Your Name"
              className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2C6252] placeholder:text-gray-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              variants={inputField}
              custom={1}
              initial="hidden"
              animate="visible"
            />
            <Motion.input
              id="phone"
              type="tel"
              placeholder="Phone Number"
              className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2C6252] placeholder:text-gray-400"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              variants={inputField}
              custom={2}
              initial="hidden"
              animate="visible"
            />
            <Motion.input
              id="guests"
              type="number"
              min="1"
              placeholder="Number of Guests"
              className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#2C6252] placeholder:text-gray-400"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              variants={inputField}
              custom={3}
              initial="hidden"
              animate="visible"
            />

            {/* Date & Time Picker */}
            <Motion.div variants={inputField} custom={4} initial="hidden" animate="visible">
              <DatePicker
                selected={reservationDate}
                onChange={handleDateChange}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={30}
                dateFormat="MMMM do, yyyy ' & ' h:mm aa"
                placeholderText="Select Date & Time"
                className="w-full border border-gray-300 p-3 focus:outline-none focus:ring-1 focus:ring-[#2C6252] text-sm cursor-pointer placeholder:text-gray-400"
                wrapperClassName="w-full"
                minDate={new Date()}
                filterTime={(time) => {
                  const totalMinutes = time.getHours() * 60 + time.getMinutes();
                  return totalMinutes >= 10 * 60 && totalMinutes <= 22 * 60; // 10:00 - 22:00
                }}
                dayClassName={(date) => {
                  const today = new Date();
                  const isSelected =
                    reservationDate &&
                    date.getDate() === reservationDate.getDate() &&
                    date.getMonth() === reservationDate.getMonth() &&
                    date.getFullYear() === reservationDate.getFullYear();
                  if (isSelected) return "bg-blue-500 text-white rounded-full";
                  if (
                    date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear()
                  )
                    return "border border-[#2C6252] rounded-full";
                  return "";
                }}
                id="date-time"
              />
            </Motion.div>

            <Motion.div variants={inputField} custom={5} initial="hidden" animate="visible">
              <Select<TableOption>
                inputId="table-select"
                instanceId="table-select"
                options={tableOptions}
                value={selectedTable}
                onChange={handleTableSelect}
                placeholder={
                  hasSelectedDate ? "Select a Table" : "Select date & time first"
                }
                isSearchable={false}
                isDisabled={!hasSelectedDate || isLoadingTables}
                noOptionsMessage={() => "No tables available at this time"}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: "#d1d5db",
                    minHeight: "44px",
                    fontSize: "0.95rem",
                    boxShadow: "none",
                    "&:hover": { borderColor: "#2C6252" },
                  }),
                }}
              />
            </Motion.div>

            <Motion.button
              type="button"
              onClick={handleBookTable}
              disabled={isSubmitting}
              className="mt-4 bg-[#2C6252] hover:bg-[#244f42] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 transition-all"
              whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.96 }}
            >
              {isSubmitting ? "Booking..." : "Book Table"}
            </Motion.button>
          </form>
        </Motion.div>
      </Motion.section>
    </Container>
  );
};

export default Reserve;