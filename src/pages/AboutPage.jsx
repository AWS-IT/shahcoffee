import About from '../components/About.jsx';

export default function AboutPage() {
  return (
    <section style={{ paddingTop: '100px', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <About />
      </div>
    </section>
  );
}