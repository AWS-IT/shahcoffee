import About from '../components/About.jsx';

export default function AboutPage() {
  return (
    <section style={{ padding: '100px 20px', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '50px' }}>О компании ШАХ</h1>
        <About />
      </div>
    </section>
  );
}