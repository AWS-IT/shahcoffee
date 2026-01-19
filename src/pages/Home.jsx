import Hero from '../components/Hero.jsx';
import About from '../components/About.jsx';
import CatalogPreview from '../components/CatalogPreview.jsx';
import ConstructorPromo from '../components/ConstructorPromo.jsx';
import DeliverySection from '../components/DeliverySection.jsx'
import HomeMap from '../components/HomeMap.jsx'

export default function Home() {
  return (
    <>
      <Hero />
      <About id="about" />
      <section id="dvs"><HomeMap /></section>
      <section id="catalog"><CatalogPreview /></section>
      <DeliverySection/>
      {/*<ConstructorPromo id="constructor" />*/}
    </>
  );
}