import { ReactNode } from "react";

const Container = ({ children }: { children: ReactNode }) => (
  <div className="w-full px-4 sm:px-6 mx-auto 3xl:max-w-[1500px] 2xl:max-w-[1200px] xl:max-w-[1100px] lg:max-w-[900px] md:max-w-[750px] sm:max-w-[320px]">
    {children}
  </div>
);

export default Container;