import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Historia from "@/components/landing/Historia";
import Services from "@/components/landing/Services";
import Productos from "@/components/landing/Productos";
import About from "@/components/landing/About";
import Clients from "@/components/landing/Clients";
import Contact from "@/components/landing/Contact";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Historia />
        <Services />
        <Productos />
        <About />
        <Clients />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
