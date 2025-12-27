import Hero from '../components/Hero.jsx';
import About from '../components/About.jsx';
import CatalogPreview from '../components/CatalogPreview.jsx';
import ConstructorPromo from '../components/ConstructorPromo.jsx';
import MapSection from '../components/MapSection.jsx';
import DeliverySection from '../components/DeliverySection.jsx'

export default function Home() {
  return (
    <>
      <Hero />
      <About id="about" />
      <section id="catalog"><CatalogPreview /></section>
      <DeliverySection/>
      {/*<ConstructorPromo id="constructor" />*/}
      <MapSection id="contacts" />
    </>
  );
}