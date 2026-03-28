import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Experience from "@/components/Experience";
import Projects from "@/components/Projects";
import Skills from "@/components/Skills";
import Certifications from "@/components/Certifications";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        {/* Divider */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="border-t border-gray-900" />
        </div>
        <About />
        <div className="max-w-6xl mx-auto px-6">
          <div className="border-t border-gray-900" />
        </div>
        <Experience />
        <div className="max-w-6xl mx-auto px-6">
          <div className="border-t border-gray-900" />
        </div>
        <Projects />
        <div className="max-w-6xl mx-auto px-6">
          <div className="border-t border-gray-900" />
        </div>
        <Skills />
        <div className="max-w-6xl mx-auto px-6">
          <div className="border-t border-gray-900" />
        </div>
        <Certifications />
        <div className="max-w-6xl mx-auto px-6">
          <div className="border-t border-gray-900" />
        </div>
        <Contact />
      </main>
      <Footer />
    </>
  );
}
