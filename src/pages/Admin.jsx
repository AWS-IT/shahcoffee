import React, { useState, useEffect } from 'react'
import AddressSuggest from '../components/AddressSuggest'
import '../styles/admin.css'

export default function Admin() {
  // Состояние для меток
  const [markers, setMarkers] = useState([])
  const [markersLoading, setMarkersLoading] = useState(false)
  const [showMarkerForm, setShowMarkerForm] = useState(false)
  const [editingMarker, setEditingMarker] = useState(null)
  const [addressInput, setAddressInput] = useState('') // Для поля ввода адреса
  const [markerForm, setMarkerForm] = useState({
    title: '',
    description: '',
    address: '',
    lat: '',
    lon: '',
    icon_color: 'red',
    is_active: true
  })

  useEffect(() => {
    loadMarkers()
  }, [])

  const loadMarkers = async () => {
    setMarkersLoading(true)
    try {
      const response = await fetch('/api/admin/markers')
      const data = await response.json()
      if (Array.isArray(data)) {
        setMarkers(data)
      }
    } catch (error) {
      console.error('Ошибка загрузки меток:', error)
    } finally {
      setMarkersLoading(false)
    }
  }

  const handleAddressSelect = (suggestion) => {
    setMarkerForm(prev => ({
      ...prev,
      address: suggestion.address,
      lat: suggestion.coordinates.lat,
      lon: suggestion.coordinates.lon
    }))
  }

  const resetMarkerForm = () => {
    setMarkerForm({
      title: '',
      description: '',
      address: '',
      lat: '',
      lon: '',
      icon_color: 'red',
      is_active: true
    })
    setAddressInput('')
    setEditingMarker(null)
    setShowMarkerForm(false)
  }

  const handleMarkerSubmit = async (e) => {
    e.preventDefault()
    
    if (!markerForm.title || !markerForm.lat || !markerForm.lon) {
      alert('Заполните название и выберите адрес')
      return
    }

    try {
      const url = editingMarker 
        ? `/api/admin/markers/${editingMarker.id}`
        : '/api/admin/markers'
      
      const response = await fetch(url, {
        method: editingMarker ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(markerForm)
      })

      if (response.ok) {
        loadMarkers()
        resetMarkerForm()
      } else {
        alert('Ошибка сохранения метки')
      }
    } catch (error) {
      console.error('Ошибка:', error)
      alert('Ошибка сохранения метки')
    }
  }

  const handleEditMarker = (marker) => {
    setMarkerForm({
      title: marker.title,
      description: marker.description || '',
      address: marker.address || '',
      lat: marker.lat,
      lon: marker.lon,
      icon_color: marker.icon_color || 'red',
      is_active: marker.is_active
    })
    setAddressInput(marker.address || '')
    setEditingMarker(marker)
    setShowMarkerForm(true)
  }

  const handleDeleteMarker = async (id) => {
    if (!confirm('Удалить метку?')) return
    
    try {
      await fetch(`/api/admin/markers/${id}`, { method: 'DELETE' })
      loadMarkers()
    } catch (error) {
      console.error('Ошибка удаления:', error)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1>Панель администратора</h1>

        <div className="admin-card markers-section">
          <div className="markers-header">
            <h2>📍 Метки на карте</h2>
              <button 
                className="btn-primary"
                onClick={() => setShowMarkerForm(!showMarkerForm)}
              >
                {showMarkerForm ? '✕ Закрыть' : '+ Добавить метку'}
              </button>
            </div>

            {showMarkerForm && (
              <form onSubmit={handleMarkerSubmit} className="marker-form">
                <h3>{editingMarker ? 'Редактировать метку' : 'Новая метка'}</h3>
                
                <div className="form-group">
                  <label>Название *</label>
                  <input
                    type="text"
                    value={markerForm.title}
                    onChange={(e) => setMarkerForm({...markerForm, title: e.target.value})}
                    placeholder="Название точки"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Описание (текст в балуне)</label>
                  <textarea
                    value={markerForm.description}
                    onChange={(e) => setMarkerForm({...markerForm, description: e.target.value})}
                    placeholder="Описание, которое появится при клике на метку"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Адрес (поиск) *</label>
                  <AddressSuggest 
                    value={addressInput}
                    onChange={setAddressInput}
                    onSelect={handleAddressSelect}
                    placeholder="Начните вводить адрес..."
                  />
                  {markerForm.address && (
                    <p className="selected-address">✓ Выбран: {markerForm.address}</p>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Широта</label>
                    <input
                      type="text"
                      value={markerForm.lat}
                      onChange={(e) => setMarkerForm({...markerForm, lat: e.target.value})}
                      placeholder="55.7558"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Долгота</label>
                    <input
                      type="text"
                      value={markerForm.lon}
                      onChange={(e) => setMarkerForm({...markerForm, lon: e.target.value})}
                      placeholder="37.6173"
                      readOnly
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Цвет метки</label>
                    <select
                      value={markerForm.icon_color}
                      onChange={(e) => setMarkerForm({...markerForm, icon_color: e.target.value})}
                    >
                      <option value="red">🔴 Красный</option>
                      <option value="blue">🔵 Синий</option>
                      <option value="green">🟢 Зелёный</option>
                      <option value="orange">🟠 Оранжевый</option>
                      <option value="violet">🟣 Фиолетовый</option>
                      <option value="yellow">🟡 Жёлтый</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Статус</label>
                    <select
                      value={markerForm.is_active ? 'true' : 'false'}
                      onChange={(e) => setMarkerForm({...markerForm, is_active: e.target.value === 'true'})}
                    >
                      <option value="true">✅ Активна</option>
                      <option value="false">❌ Скрыта</option>
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    {editingMarker ? 'Сохранить' : 'Создать метку'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={resetMarkerForm}>
                    Отмена
                  </button>
                </div>
              </form>
            )}

            <div className="markers-list">
              {markersLoading ? (
                <p>Загрузка...</p>
              ) : markers.length === 0 ? (
                <p className="no-markers">Меток пока нет. Добавьте первую!</p>
              ) : (
                markers.map(marker => (
                  <div key={marker.id} className={`marker-item ${!marker.is_active ? 'inactive' : ''}`}>
                    <div className="marker-info">
                      <span className={`marker-color color-${marker.icon_color}`}>●</span>
                      <div>
                        <strong>{marker.title}</strong>
                        {marker.address && <p className="marker-address">{marker.address}</p>}
                        {marker.description && <p className="marker-desc">{marker.description}</p>}
                      </div>
                    </div>
                    <div className="marker-actions">
                      <button onClick={() => handleEditMarker(marker)} className="btn-edit">✏️</button>
                      <button onClick={() => handleDeleteMarker(marker.id)} className="btn-delete">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
  )
}
