import CatalogPreview from '../components/CatalogPreview.jsx';

export default function CatalogPage() {
  return (
    <section style={{ paddingTop: '70px ', background: '#f9f9fb', minHeight: '80vh' }}>
      <div style={{ maxWidth: '1480px', margin: '0 auto' }}>
        
        <CatalogPreview />
      </div>
    </section>
  );
}