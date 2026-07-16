"use client";

import Image from "next/image";
import { motion as Motion } from "framer-motion";
import Container from "@/components/Container";

interface TeamMember {
  id: number;
  name: string;
  image: string;
  yearsExperience: number;
  rating: number;
}

const teamMembers: TeamMember[] = [
  {
    id: 1,
    name: "Sophia M.",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752061029/chef5_w0l3nb.webp",
    yearsExperience: 5,
    rating: 5,
  },
  {
    id: 2,
    name: "Sophia M.",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752061398/chef6_aqp9rp.webp",
    yearsExperience: 5,
    rating: 5,
  },
  {
    id: 3,
    name: "Sophia M.",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752061291/pngegg_31_opzccv_nwcjk9.webp",
    yearsExperience: 5,
    rating: 5,
  },
  {
    id: 4,
    name: "Sophia M.",
    image:
      "https://res.cloudinary.com/dxohwanal/image/upload/v1752061029/chef5_w0l3nb.webp",
    yearsExperience: 5,
    rating: 5,
  },
];

const Members = () => {
  return (
    <Container>
      <section
        className="py-8 md:py-12 3xl:px-16 2xl:px-20 xl:px-44 lg:px-0 md:px-0 sm:px-0 3xl:mt-36 2xl:mt-32 xl:mt-32 lg:mt-24 md:mt-20 sm:mt-14 3xl:mb-36 2xl:mb-40 xl:mb-28 lg:mb-28 sm:-ml-[10.5rem] 3xl:-ml-0 2xl:-ml-0 xl:-ml-0 lg:-ml-0 md:-ml-0 sm:w-full 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full"
        aria-label="Meet Our Team"
      >
        {/* Header */}
        <Motion.div
          className="mb-10 md:mb-16 text-left flex justify-end items-center 3xl:ml-0 2xl:ml-0 xl:ml-0 md:ml-0 sm:ml-[9.5rem] sm:w-28 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          viewport={{ once: true }}
        >
          <h1 className="text-3xl 3xl:text-5xl 2xl:text-4xl xl:text-2xl lg:text-2xl md:text-2xl sm:text-sm font-bold text-[#2C6252] mb-2 leading-relaxed 3xl:mr-8 2xl:mr-16 xl:-mr-16 lg:mr-20 md:mr-36 sm:-mr-0">
            Our expertise all team <br className="hidden md:block" />
            <span className="inline-flex items-center leading-relaxed">
              members
              <span className="bg-[#FF4C15] text-white 3xl:text-sm 2xl:text-sm xl:text-sm lg:text-[10px] md:text-[12px] sm:text-[8px] 3xl:px-4 3xl:py-2 2xl:px-4 2xl:py-2 xl:px-4 xl:py-2 md:px-4 md:py-2 sm:px-2 sm:py-1 flex items-center space-x-2 ml-4">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                <span className="whitespace-nowrap">Company Details (Chef)</span>
              </span>
            </span>
          </h1>
        </Motion.div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 3xl:gap-8 2xl:gap-8 xl:gap-8 lg:gap-4 items-center sm:w-[15rem] 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full">
          {/* Left Image */}
          <Motion.figure
            className="flex justify-end relative 3xl:left-2 2xl:-left-14 xl:-left-[7.5rem] lg:left-2 md:left-4 sm:left-[2.4rem] bg-[#3F7765] 3xl:h-[99%] 3xl:w-[75%] 2xl:h-[99.8%] 2xl:w-[80%] xl:h-[99.8%] xl:w-[94%] lg:h-[99.8%] lg:w-[95%] md:w-[94%] sm:w-[97%] sm:h-auto"
            role="img"
            aria-label="Featured Chef"
          >
            <Motion.div
              className="3xl:-ml-16 3xl:-mr-[22.4rem] 3xl:-mt-32 2xl:-ml-60 2xl:-mr-[20rem] xl:-ml-36 xl:-mr-[27rem] 2xl:-mt-36 xl:-mt-48 lg:-ml-44 lg:-mr-[7rem] lg:-mt-48"
              initial={{ y: 100, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut", type: "tween" }}
              viewport={{ once: true }}
            >
              <Image
                src="https://res.cloudinary.com/dxohwanal/image/upload/v1752059008/chef4_pgbdux.webp"
                alt="Portrait of happy male chef in uniform"
                width={800}
                height={1000}
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-contain h-auto 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-full sm:w-52 3xl:-ml-2 2xl:ml-6 xl:-ml-16 lg:ml-4 sm:ml-6 xl:mt-[5.93rem] 3xl:mt-0 2xl:mt-0 lg:mt-[5.93rem]"
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src =
                    "https://placehold.co/400x600/A0A0A0/FFFFFF?text=Image+Error";
                }}
              />
            </Motion.div>
          </Motion.figure>

          {/* Right Team Cards */}
          <Motion.div
            className="grid grid-cols-1 md:grid-cols-2 3xl:gap-x-20 3xl:gap-y-20 2xl:gap-x-36 2xl:gap-y-20 xl:gap-x-40 xl:gap-y-24 lg:gap-x-5 lg:gap-y-12 md:gap-x-0 md:gap-y-24 sm:gap-x-0 sm:gap-y-16 3xl:ml-20 2xl:ml-0 xl:ml-10 lg:-ml-1 md:ml-20 sm:ml-14 md:mt-16 3xl:mt-0 2xl:mt-0 xl:mt-0 lg:mt-0 sm:mt-20 sm:w-[10rem] 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-[30rem]"
            initial="hidden"
            whileInView="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.2 } },
            }}
            viewport={{ once: true }}
            aria-label="Team Members"
          >
            {teamMembers.map((member) => (
              <Motion.article
                key={member.id}
                className="relative bg-white p-4 flex flex-col justify-end items-center text-center 3xl:h-[200px] 3xl:w-[250px] 2xl:h-[200px] 2xl:w-[220px] xl:h-[200px] xl:w-[170px] lg:h-[150px] lg:w-[180px] md:h-[180px] md:w-[180px] sm:h-[120px] sm:w-[210px] border border-gray-400"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <Image
                  src={member.image}
                  alt={`Team member ${member.name}`}
                  width={250}
                  height={300}
                  sizes="(min-width: 1024px) 20vw, 45vw"
                  className="absolute bottom-0 w-full h-[120%] object-contain z-0"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src =
                      "https://placehold.co/150x200/A0A0A0/FFFFFF?text=Image+Error";
                  }}
                />
                <div className="absolute top-0 right-0 bg-[#FF4C15] text-white p-1 text-xs z-20">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM5.3 8.3a1 1 0 011.4 0L10 11.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z"></path>
                  </svg>
                </div>
                <figcaption className="absolute 3xl:-left-8 2xl:-left-4 xl:-left-4 lg:-left-3 md:-left-3 sm:-left-3 top-28 -rotate-90 origin-left 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-sm sm:text-xs font-semibold text-[#2C6252] whitespace-nowrap z-20">
                  - {member.name}
                </figcaption>
                <div className="relative z-10 w-full mt-auto flex flex-col items-center text-gray-700 bg-white bg-opacity-75 px-2 py-1">
                  <p className="text-xl font-bold">{member.yearsExperience}</p>
                  <p className="text-xs text-gray-500 mb-1">five year experience</p>
                  <div
                    className="flex justify-center space-x-1 text-yellow-400"
                    aria-label="Rating"
                  >
                    {[...Array(member.rating)].map((_, i) => (
                      <svg
                        key={i}
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.683-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.565-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </Motion.article>
            ))}
          </Motion.div>
        </div>
      </section>
    </Container>
  );
};

export default Members;