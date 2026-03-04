import Hero from '../components/Hero.jsx';
import About from '../components/About.jsx';
import CatalogPreview from '../components/CatalogPreview.jsx';
import ConstructorPromo from '../components/ConstructorPromo.jsx';
import ServicePromo from '../components/ServicePromo.jsx';
import DeliverySection from '../components/DeliverySection.jsx'
import HomeMap from '../components/HomeMap.jsx'

export default function Home() {
  return (
    <>
      <Hero />
      <ServicePromo />
      <section id="catalog"><CatalogPreview /></section>
      <section id="dvs"><HomeMap /></section>
      <About id="about" />
      <DeliverySection />
    </>
  );
}