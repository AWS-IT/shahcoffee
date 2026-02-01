import React, { useState } from 'react';

function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    company: '',
    comment: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Данные формы:', formData);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', phone: '', company: '', comment: '' });
    }, 4000);
  };

  return (
    <section id="contacts" className="section section--contacts">
      <div className="container">
        <h2 className="section__title">Контакты и заявка</h2>

        <div className="contacts__layout">
          <div className="contacts__info">
            <h3 className="contacts__info-title">Свяжитесь с нами</h3>
            <div className="contacts__info-item">
              <span className="contacts__info-label">Телефон:</span>
              <a href="tel:+79293333388" className="contacts__info-link">
                +7 (929) 333-33-88
              </a>
            </div>
            <div className="contacts__info-item">
              <span className="contacts__info-label">Email:</span>
              <a href="mailto:info@cup.studio" className="contacts__info-link">
                info@cup.studio
              </a>
            </div>
            <div className="contacts__info-item">
              <span className="contacts__info-label">Город:</span>
              <span>Москва</span>
            </div>
          </div>

          <form className="contacts__form" onSubmit={handleSubmit}>
            <h3 className="contacts__form-title">Оставить заявку</h3>
            <div className="contacts__form-group">
              <input
                type="text"
                name="name"
                placeholder="Ваше имя"
                value={formData.name}
                onChange={handleChange}
                required
                className="contacts__form-input"
              />
            </div>
            <div className="contacts__form-group">
              <input
                type="tel"
                name="phone"
                placeholder="Телефон"
                value={formData.phone}
                onChange={handleChange}
                required
                className="contacts__form-input"
              />
            </div>
            <div className="contacts__form-group">
              <input
                type="text"
                name="company"
                placeholder="Название компании"
                value={formData.company}
                onChange={handleChange}
                className="contacts__form-input"
              />
            </div>
            <div className="contacts__form-group">
              <textarea
                name="comment"
                placeholder="Комментарий к заказу"
                value={formData.comment}
                onChange={handleChange}
                rows="4"
                className="contacts__form-textarea"
              />
            </div>
            <button type="submit" className="btn btn--primary">
              Оставить заявку
            </button>
            {submitted && (
              <p className="contacts__form-success">
                Спасибо, заявка отправлена (заглушка)
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

export default ContactForm;