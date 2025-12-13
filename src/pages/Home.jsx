import Hero from '../components/Hero.jsx';
import About from '../components/About.jsx';
import CatalogPreview from '../components/CatalogPreview.jsx';
import ConstructorPromo from '../components/ConstructorPromo.jsx';
import MapSection from '../components/MapSection.jsx';

export default function Home() {
  return (
    <>
      <Hero />
      <About id="about" />
      <section id="catalog"><CatalogPreview /></section>
      <ConstructorPromo id="constructor" />
      <MapSection id="contacts" />
    </>
  );
}