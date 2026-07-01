"use client";

import { motion as Motion } from "framer-motion";
import Container from "@/components/Container";

const Awards = () => {
  return (
    <Container>
      <div className="relative 3xl:overflow-hidden 2xl:overflow-hidden xl:overflow-hidden lg:overflow-hidden min-h-[1800px] 3xl:-mt-12 2xl:-mt-12 xl:-mt-20 lg:-mt-0 md:-mt-0 sm:-mt-0 3xl:right-10 2xl:right-20 xl:right-20 lg:right-20 md:right-0 sm:right-14 3xl:w-full 2xl:w-full xl:w-full lg:w-full md:w-[30rem] sm:w-[5rem]">

        {/* Foreground Image (Chef) */}
        <div className="absolute left-1/2 sm:top-[10%] md:top-[25%] lg:top-[33%] xl:top-[44%] 2xl:top-[50%] 3xl:top-[54%] z-10 3xl:translate-x-[-50%] 2xl:translate-x-[-50%] xl:translate-x-[-48%] lg:translate-x-[-48%] md:translate-x-[-48%] sm:translate-x-[-44%] translate-y-[-104%] flex items-center justify-center">
          <img
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1752057824/chef1_aauap9.webp"
            alt="Award-winning chef with culinary excellence"
            className="sm:w-[245px] md:w-[550px] lg:w-[820px] 2xl:w-[1100px] xl:w-[950px] 3xl:w-[1250px] max-w-none"            
          />
        </div>

        {/* Centered Specialty Image */}
        <div className="relative flex justify-start sm:ml-32 md:ml-20 lg:ml-32 2xl:ml-32 xl:ml-32 3xl:ml-0 sm:w-[200px] md:w-[600px] lg:w-[600px] xl:w-[1100px] 2xl:w-[1100px] 3xl:w-full 3xl:justify-center sm:hidden md:hidden lg:block xl:block 2xl:block 3xl:block">
          <img
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1744863980/Specialty_c98mbf.png"
            alt="Our food specialty display"
            className="sm:mt-36 md:mt-36 lg:mt-36 xl:mt-52 2xl:mt-52 3xl:-mt-1"
            loading="lazy"
          />
        </div>

        {/* Floating Badge Icon */}
        <Motion.div
          className="absolute 3xl:left-28 2xl:left-16 xl:left-20 lg:left-14 md:-left-4 sm:-left-14 sm:top-[1.8rem] md:top-[5rem] lg:top-[5rem] xl:top-[12rem] 2xl:top-[13rem] 3xl:top-48 z-50"
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          aria-label="Award badge animation"
        >
          <img
            src="https://res.cloudinary.com/dxohwanal/image/upload/v1744793790/Group_253_oyljhb.png"
            className="sm:w-12 md:w-32 lg:w-32 xl:w-44 2xl:w-44 3xl:w-full rounded-full"
            alt="Award badge"
            loading="lazy"
          />
        </Motion.div>

        {/* Green Food */}
        <div className="absolute left-1/2 sm:top-[3.5rem] md:top-[12rem] lg:top-[14rem] xl:top-[21rem] 2xl:top-[22rem] 3xl:top-[24rem] z-50 sm:-translate-x-[64px] md:-translate-x-[150px] lg:-translate-x-[210px] xl:-translate-x-[260px] 2xl:-translate-x-[300px] 3xl:-translate-x-[360px] whitespace-nowrap">
          <span className='text-[#a9a2a2] 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-[12px] md:text-[11px] sm:text-[6px]'>Green</span>
          <span className='text-[#CCCCCC] 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-[12px] md:text-[11px] sm:text-[6px]'>Food</span>
        </div>

        {/* Healthy Food */}
        <div className="absolute left-1/2 sm:top-[6.5rem] md:top-[17rem] lg:top-[20rem] xl:top-[28rem] 2xl:top-[36rem] 3xl:top-[33rem] z-50 sm:-translate-x-[110px] md:-translate-x-[220px] lg:-translate-x-[320px] xl:-translate-x-[400px] 2xl:-translate-x-[440px] 3xl:-translate-x-[520px] sm:hidden md:block lg:block xl:block 2xl:block 3xl:block">
          <span className='text-[#CCCCCC] 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-[12px] md:text-[12px] sm:text-[8px]'>Healthy</span>
          <span className='text-[#a9a2a2] 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-[12px] md:text-[12px] sm:text-[8px]'>Food</span>
        </div>

        {/* Decorative Blur Element */}
        <div className="absolute left-1/2 sm:top-[28rem] md:top-[28rem] lg:top-[28rem] xl:top-[42rem] 2xl:top-[42rem] 3xl:top-[37rem] z-50 lg:-translate-x-[330px] xl:-translate-x-[400px] 2xl:-translate-x-[400px] 3xl:-translate-x-[500px] sm:hidden md:hidden lg:block xl:block 2xl:block 3xl:block">
          <img className='opacity-20 blur-sm' src="/Ellipse 9.svg" alt="Decorative ellipse blur" loading="lazy" />
        </div>

        {/* Experiences Tag */}
        <Motion.div
          className="absolute 3xl:left-[24rem] 2xl:left-[18rem] xl:left-[17rem] lg:left-[14rem] md:left-[6.5rem] md:top-[6rem] lg:top-[4rem] xl:top-[11rem] 2xl:top-44 3xl:top-36 z-50 rounded-full 3xl:px-4 3xl:py-2 2xl:px-4 2xl:py-2 xl:px-4 xl:py-2 lg:px-4 lg:py-1 md:px-2 md:py-0 md:-translate-x-[140px] lg:-translate-x-[150px] xl:-translate-x-[250px] 2xl:-translate-x-[250px] 3xl:-translate-x-[300px] 3xl:w-36 2xl:w-36 xl:w-36 lg:w-24 md:w-20 sm:hidden md:block lg:block xl:block 2xl:block 3xl:block"
          style={{ border: "2px solid #4B5563" }}
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          aria-label="Years of experience rotating badge"
        >
          <div className="inline-flex items-center justify-center gap-2 w-full h-full">
            <img src="/year.png" className="3xl:w-4 2xl:w-4 xl:w-4 lg:w-3 md:w-3" alt="Years of experience badge" loading="lazy" />
            <span className="3xl:text-sm 2xl:text-sm xl:text-[12px] lg:text-[10px] md:text-[8px] font-medium text-[#FF4C15]">
              experiences
            </span>
          </div>
        </Motion.div>

        {/* 24/7 Open */}
        <div className="absolute left-1/2 md:top-[4rem] lg:top-[2rem] xl:top-[11rem] 2xl:top-52 3xl:top-48 text-gray-800 px-3 py-1 text-lg z-50 md:translate-x-[120px] lg:translate-x-[160px] xl:translate-x-[180px] 2xl:translate-x-[200px] 3xl:translate-x-[200px] sm:hidden md:hidden lg:block xl:block 2xl:block 3xl:block">
          <span className='text-[#FF4C15] font-bold 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-[14px]'>24/7</span>
          <span className='text-[#2C6252] 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-[12px]'>open</span>
        </div>

        {/* 5 Star Rating */}
        <Motion.div
          className="absolute 3xl:right-[34rem] 2xl:right-[25rem] xl:right-[22rem] lg:right-[16rem] md:right-[7rem] sm:-right-[2.5rem] sm:top-[3rem] md:top-[8.5rem] lg:top-[9rem] xl:top-[16rem] 2xl:top-[18rem] 3xl:top-72 bg-white rounded-full border border-gray-400 shadow-md 3xl:px-3 3xl:py-1 2xl:px-3 2xl:py-1 xl:px-3 xl:py-1 lg:px-3 lg:py-1 md:px-3 md:py-1 sm:px-1 sm:py-0 text-yellow-400 3xl:text-base 2xl:text-base xl:text-base md:text-sm sm:text-[8px] z-50 md:translate-x-[5px] sm:translate-x-[30px] lg:translate-x-[30px] xl:translate-x-[100px] 2xl:translate-x-[100px] 3xl:translate-x-[100px]"
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          aria-label="5 star rating animation"
        >
          ★★★★★
        </Motion.div>

        {/* Live Kitchen */}
        <Motion.div
          className="absolute left-1/2 sm:top-[1rem] md:top-[7rem] lg:top-[7rem] xl:top-[15rem] 2xl:top-[16rem] 3xl:top-64 text-gray-800 px-3 py-1 rounded-full 3xl:text-[26px] 2xl:text-[26px] xl:text-[26px] lg:text-[26px] md:text-[26px] sm:text-[7px] z-50 sm:translate-x-[78px] md:translate-x-[165px] lg:translate-x-[290px] xl:translate-x-[320px] 2xl:translate-x-[350px] 3xl:translate-x-[430px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="relative inline-flex flex-col items-center">
            <Motion.div className="inline-flex items-center gap-1">
              <Motion.span
                className="text-[#FF4C15] font-bold 3xl:text-2xl 2xl:text-2xl xl:text-xl lg:text-base md:text-base sm:text-[5px]"
                animate={{ textShadow: ["0 0 10px #FF4C15", "0 0 0px #FF4C15", "0 0 10px #FF4C15"] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                Live
              </Motion.span>
              <Motion.span
                className="font-bold 3xl:text-2xl 2xl:text-2xl xl:text-xl lg:text-base md:text-base sm:text-[5px]"
                animate={{ opacity: [1, 0.8, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                kitchen
              </Motion.span>
            </Motion.div>
            <Motion.img
              src="https://res.cloudinary.com/dxohwanal/image/upload/v1744868965/Mask_Group_3_zd2ur0.png"
              className="mt-2 3xl:w-40 2xl:w-40 xl:w-32 lg:w-24 md:w-24 sm:w-10"
              alt="Live kitchen photo"
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              loading="lazy"
            />
            <Motion.div
              className="absolute -top-6 3xl:w-8 3xl:h-8 2xl:w-8 2xl:h-8 xl:w-8 xl:h-8 lg:w-8 lg:h-8 md:w-8 md:h-8 sm:w-4 sm:h-4 bg-transparent"
              animate={{ y: [-5, -25], opacity: [0.4, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            >
              <div className="w-full h-full rounded-full bg-white blur-sm opacity-40" />
            </Motion.div>
          </div>
        </Motion.div>

        {/* Organic Food */}
        <div className="absolute left-1/2 sm:top-[3.2rem] md:top-[12rem] lg:top-[13rem] xl:top-[27rem] 2xl:top-[24rem] 3xl:top-96 px-3 py-1 text-lg z-50 sm:translate-x-[40px] md:translate-x-[100px] lg:translate-x-[160px] xl:translate-x-[170px] 2xl:translate-x-[190px] 3xl:translate-x-[210px] whitespace-nowrap">
          <span className='font-bold text-[#a9a2a2] 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-[11px] sm:text-[6px]'>Organic</span>
          <span className='text-[#CCCCCC] 3xl:text-lg 2xl:text-lg xl:text-lg lg:text-[11px] sm:text-[6px]'>Food</span>
        </div>
      </div>

      {/* Quality | Profitability | Consistency */}
      <div className="absolute left-1/2 3xl:top-[52rem] 2xl:top-[48rem] xl:top-[41rem] lg:top-[35rem] md:top-[27rem] 3xl:translate-x-[-45%] 2xl:translate-x-[-45%] xl:translate-x-[-45%] lg:translate-x-[-42%] md:translate-x-[-37%] z-50 w-full 3xl:max-w-[1220px] 2xl:max-w-[1110px] xl:max-w-[950px] lg:max-w-[800px] md:max-w-[580px] sm:hidden md:block lg:block xl:block 2xl:block 3xl:block">
        <div className="grid grid-cols-3 text-white font-bold text-center 3xl:text-4xl 2xl:text-4xl xl:text-4xl lg:text-3xl md:text-lg divide-x divide-[#CCCCCC] bg-[#406D5B] overflow-hidden 3xl:px-24 3xl:py-24 2xl:px-20 2xl:py-20 xl:px-16 xl:py-16 lg:px-12 lg:py-12 md:px-8 md:py-8 3xl:-ml-6 2xl:-ml-10 xl:-ml-10 md:-ml-20">
          <div className="py-4">Quality</div>
          <div className="py-4">Profitability</div>
          <div className="py-4">Consistency</div>
        </div>
      </div>
    </Container>
  );
};

export default Awards;