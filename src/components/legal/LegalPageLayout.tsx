import type { ReactNode } from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

type LegalPageLayoutProps = {
  children: ReactNode;
};

const LegalPageLayout = ({ children }: LegalPageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Header alwaysSolid />
      <main className="pt-28 pb-16 lg:pt-32 lg:pb-24">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">{children}</div>
      </main>
      <Footer />
    </div>
  );
};

export default LegalPageLayout;
