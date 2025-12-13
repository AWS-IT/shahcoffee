import CatalogPreview from '../components/CatalogPreview.jsx';

export default function CatalogPage() {
  return (
    <section style={{ padding: '100px 20px', background: '#f9f9fb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1480px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', fontSize: '3rem', marginBottom: '60px' }}>
          Каталог товаров
        </h1>
        <CatalogPreview />
      </div>
    </section>
  );
}