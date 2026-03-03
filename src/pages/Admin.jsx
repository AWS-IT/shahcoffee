import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AddressSuggest from '../components/AddressSuggest'
import '../styles/admin.css'

export default function Admin() {
  const { isAuthenticated, isAdmin, token, checkAdmin } = useAuth()
  const [hasAccess, setHasAccess] = useState(null) // null = загрузка, true/false = результат
  const [accessError, setAccessError] = useState('')
  
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

  // Состояние для складов
  const [stores, setStores] = useState([])
  const [selectedStore, setSelectedStore] = useState('')
  const [storesLoading, setStoresLoading] = useState(false)
  const [storeSaving, setStoreSaving] = useState(false)

  // Состояние для пунктов выдачи
  const [pickupPoints, setPickupPoints] = useState([])
  const [pickupPointsLoading, setPickupPointsLoading] = useState(false)
  const [showPickupForm, setShowPickupForm] = useState(false)
  const [editingPickup, setEditingPickup] = useState(null)
  const [pickupAddressInput, setPickupAddressInput] = useState('')
  const [pickupForm, setPickupForm] = useState({
    name: '',
    address: '',
    lat: '',
    lon: '',
    description: '',
    working_hours: '',
    store_id: '',
    is_active: true
  })

  // Состояние для управления пользователями
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showUsersSection, setShowUsersSection] = useState(false)

  // Проверка доступа при загрузке
  useEffect(() => {
    const verifyAccess = async () => {
      if (!isAuthenticated || !token) {
        setHasAccess(false)
        setAccessError('Требуется авторизация')
        return
      }
      
      const adminStatus = await checkAdmin()
      setHasAccess(adminStatus)
      if (!adminStatus) {
        setAccessError('У вас нет прав администратора')
      }
    }
    
    verifyAccess()
  }, [isAuthenticated, token, checkAdmin])

  useEffect(() => {
    if (hasAccess) {
      loadMarkers()
      loadStores()
      loadSelectedStore()
      loadPickupPoints()
    }
  }, [hasAccess])

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  })

  // Загрузка списка складов
  const loadStores = async () => {
    setStoresLoading(true)
    try {
      const response = await fetch('/api/admin/stores', {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        setStores(data)
      }
    } catch (error) {
      console.error('Ошибка загрузки складов:', error)
    } finally {
      setStoresLoading(false)
    }
  }

  // Загрузка пользователей
  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const response = await fetch('/api/admin/users', { headers: getAuthHeaders() })
      if (response.ok) {
        const data = await response.json()
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  // Переключение прав админа
  const handleToggleAdmin = async (userId, currentIsAdmin) => {
    const action = currentIsAdmin ? 'снять права админа' : 'назначить админом'
    if (!confirm(`Вы уверены, что хотите ${action} у пользователя #${userId}?`)) return
    
    try {
      const response = await fetch(`/api/admin/users/${userId}/set-admin`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isAdmin: !currentIsAdmin })
      })
      if (response.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u))
      } else {
        const data = await response.json()
        alert(data.error || 'Ошибка изменения прав')
      }
    } catch (error) {
      console.error('Ошибка:', error)
      alert('Ошибка изменения прав')
    }
  }

  // Загрузка текущего выбранного склада
  const loadSelectedStore = async () => {
    try {
      const response = await fetch('/api/settings/selected_store')
      const data = await response.json()
      if (data.value) {
        setSelectedStore(data.value)
      }
    } catch (error) {
      console.error('Ошибка загрузки настройки склада:', error)
    }
  }

  // Сохранение выбранного склада
  const handleStoreChange = async (storeId) => {
    setSelectedStore(storeId)
    setStoreSaving(true)
    try {
      const response = await fetch('/api/admin/settings/selected_store', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: storeId })
      })
      if (response.ok) {
        console.log('✓ Склад сохранён')
      }
    } catch (error) {
      console.error('Ошибка сохранения склада:', error)
    } finally {
      setStoreSaving(false)
    }
  }

  const loadMarkers = async () => {
    setMarkersLoading(true)
    try {
      const response = await fetch('/api/admin/markers', {
        headers: getAuthHeaders()
      })
      
      if (response.status === 403) {
        setHasAccess(false)
        setAccessError('Доступ запрещён')
        return
      }
      
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

  // Показываем загрузку пока проверяем доступ
  if (hasAccess === null) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="admin-loading">
            <p>Проверка доступа...</p>
          </div>
        </div>
      </div>
    )
  }

  // Если нет доступа - показываем ошибку
  if (!hasAccess) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="admin-access-denied">
            <h1>🔒 Доступ запрещён</h1>
            <p>{accessError}</p>
            {!isAuthenticated ? (
              <a href="/login" className="btn-primary">Войти в аккаунт</a>
            ) : (
              <a href="/" className="btn-primary">На главную</a>
            )}
          </div>
        </div>
      </div>
    )
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
        headers: getAuthHeaders(),
        body: JSON.stringify(markerForm)
      })

      if (response.ok) {
        loadMarkers()
        resetMarkerForm()
      } else {
        const data = await response.json()
        alert(data.error || 'Ошибка сохранения метки')
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
      await fetch(`/api/admin/markers/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      loadMarkers()
    } catch (error) {
      console.error('Ошибка удаления:', error)
    }
  }

  // ——— Пункты выдачи ———
  const loadPickupPoints = async () => {
    setPickupPointsLoading(true)
    try {
      const response = await fetch('/api/admin/pickup-points', { headers: getAuthHeaders() })
      if (response.status === 403) {
        setHasAccess(false)
        setAccessError('Доступ запрещён')
        return
      }
      const data = await response.json()
      if (Array.isArray(data)) setPickupPoints(data)
    } catch (error) {
      console.error('Ошибка загрузки пунктов выдачи:', error)
    } finally {
      setPickupPointsLoading(false)
    }
  }

  const handlePickupAddressSelect = (suggestion) => {
    setPickupForm(prev => ({
      ...prev,
      address: suggestion.address,
      lat: suggestion.coordinates.lat,
      lon: suggestion.coordinates.lon
    }))
  }

  const resetPickupForm = () => {
    setPickupForm({
      name: '',
      address: '',
      lat: '',
      lon: '',
      description: '',
      working_hours: '',
      store_id: '',
      is_active: true
    })
    setPickupAddressInput('')
    setEditingPickup(null)
    setShowPickupForm(false)
  }

  const handlePickupSubmit = async (e) => {
    e.preventDefault()
    if (!pickupForm.name || !pickupForm.lat || !pickupForm.lon) {
      alert('Заполните название и выберите адрес')
      return
    }
    try {
      const url = editingPickup
        ? `/api/admin/pickup-points/${editingPickup.id}`
        : '/api/admin/pickup-points'
      const response = await fetch(url, {
        method: editingPickup ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(pickupForm)
      })
      if (response.ok) {
        loadPickupPoints()
        resetPickupForm()
      } else {
        const data = await response.json()
        alert(data.error || 'Ошибка сохранения пункта выдачи')
      }
    } catch (error) {
      console.error('Ошибка:', error)
      alert('Ошибка сохранения пункта выдачи')
    }
  }

  const handleEditPickup = (point) => {
    setPickupForm({
      name: point.name,
      address: point.address || '',
      lat: point.lat,
      lon: point.lon,
      description: point.description || '',
      working_hours: point.working_hours || '',
      store_id: point.store_id || '',
      is_active: point.is_active
    })
    setPickupAddressInput(point.address || '')
    setEditingPickup(point)
    setShowPickupForm(true)
  }

  const handleDeletePickup = async (id) => {
    if (!confirm('Удалить пункт выдачи?')) return
    try {
      await fetch(`/api/admin/pickup-points/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
      loadPickupPoints()
    } catch (error) {
      console.error('Ошибка удаления:', error)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1>Панель администратора</h1>

        {/* Секция выбора склада */}
        <div className="admin-card stores-section">
          <h2>🏪 Склад для каталога</h2>
          <p className="section-hint">Товары на сайте будут показываться только с выбранного склада</p>
          
          {storesLoading ? (
            <p>Загрузка складов...</p>
          ) : stores.length === 0 ? (
            <p className="no-stores">Склады не найдены в МойСклад</p>
          ) : (
            <div className="store-selector">
              <select 
                value={selectedStore} 
                onChange={(e) => handleStoreChange(e.target.value)}
                disabled={storeSaving}
              >
                <option value="">-- Все склады --</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name} {store.address ? `(${store.address})` : ''}
                  </option>
                ))}
              </select>
              {storeSaving && <span className="saving-indicator">💾 Сохранение...</span>}
              {selectedStore && !storeSaving && <span className="saved-indicator">✅ Сохранено</span>}
            </div>
          )}
        </div>

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

        {/* Секция пунктов выдачи */}
        <div className="admin-card markers-section">
          <div className="markers-header">
            <h2>🏪 Пункты выдачи</h2>
            <button
              className="btn-primary"
              onClick={() => setShowPickupForm(!showPickupForm)}
            >
              {showPickupForm ? '✕ Закрыть' : '+ Добавить пункт выдачи'}
            </button>
          </div>

          {showPickupForm && (
            <form onSubmit={handlePickupSubmit} className="marker-form">
              <h3>{editingPickup ? 'Редактировать пункт выдачи' : 'Новый пункт выдачи'}</h3>

              <div className="form-group">
                <label>Название *</label>
                <input
                  type="text"
                  value={pickupForm.name}
                  onChange={(e) => setPickupForm({ ...pickupForm, name: e.target.value })}
                  placeholder="Название пункта выдачи"
                  required
                />
              </div>

              <div className="form-group">
                <label>Описание (необязательно)</label>
                <textarea
                  value={pickupForm.description}
                  onChange={(e) => setPickupForm({ ...pickupForm, description: e.target.value })}
                  placeholder="Краткое описание"
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>Адрес (поиск) *</label>
                <AddressSuggest
                  value={pickupAddressInput}
                  onChange={setPickupAddressInput}
                  onSelect={handlePickupAddressSelect}
                  placeholder="Начните вводить адрес..."
                />
                {pickupForm.address && (
                  <p className="selected-address">✓ Выбран: {pickupForm.address}</p>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Широта</label>
                  <input
                    type="text"
                    value={pickupForm.lat}
                    readOnly
                    placeholder="43.1315"
                  />
                </div>
                <div className="form-group">
                  <label>Долгота</label>
                  <input
                    type="text"
                    value={pickupForm.lon}
                    readOnly
                    placeholder="45.5273"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Режим работы (необязательно)</label>
                <input
                  type="text"
                  value={pickupForm.working_hours}
                  onChange={(e) => setPickupForm({ ...pickupForm, working_hours: e.target.value })}
                  placeholder="Пн–Пт 9:00–18:00"
                />
              </div>

              <div className="form-group">
                <label>Склад в МойСклад</label>
                {storesLoading ? (
                  <p>Загрузка складов...</p>
                ) : (
                  <select
                    value={pickupForm.store_id}
                    onChange={(e) => setPickupForm({ ...pickupForm, store_id: e.target.value })}
                  >
                    <option value="">-- Не привязан --</option>
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name} {store.address ? `(${store.address})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="form-hint" style={{ fontSize: '12px', color: '#8a7b6a', marginTop: '4px' }}>
                  Привяжите пункт выдачи к складу, чтобы отображались остатки товаров
                </p>
              </div>

              <div className="form-group">
                <label>Статус</label>
                <select
                  value={pickupForm.is_active ? 'true' : 'false'}
                  onChange={(e) => setPickupForm({ ...pickupForm, is_active: e.target.value === 'true' })}
                >
                  <option value="true">✅ Активен</option>
                  <option value="false">❌ Скрыт</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingPickup ? 'Сохранить' : 'Создать пункт выдачи'}
                </button>
                <button type="button" className="btn-secondary" onClick={resetPickupForm}>
                  Отмена
                </button>
              </div>
            </form>
          )}

          <div className="markers-list">
            {pickupPointsLoading ? (
              <p>Загрузка...</p>
            ) : pickupPoints.length === 0 ? (
              <p className="no-markers">Пунктов выдачи пока нет. Добавьте первый!</p>
            ) : (
              pickupPoints.map(point => (
                <div key={point.id} className={`marker-item ${!point.is_active ? 'inactive' : ''}`}>
                  <div className="marker-info">
                    <span className="marker-color">🏪</span>
                    <div>
                      <strong>{point.name}</strong>
                      {point.address && <p className="marker-address">{point.address}</p>}
                      {(point.description || point.working_hours) && (
                        <p className="marker-desc">{point.description || ''} {point.working_hours || ''}</p>
                      )}
                      {point.store_id && (
                        <p className="marker-desc" style={{ color: '#008B9D' }}>
                          📦 Склад: {stores.find(s => s.id === point.store_id)?.name || point.store_id.slice(0, 8) + '...'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="marker-actions">
                    <button onClick={() => handleEditPickup(point)} className="btn-edit">✏️</button>
                    <button onClick={() => handleDeletePickup(point.id)} className="btn-delete">🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Секция управления пользователями */}
        <div className="admin-card users-section">
          <div className="markers-header">
            <h2>👥 Пользователи</h2>
            <button
              className="btn-primary"
              onClick={() => { setShowUsersSection(!showUsersSection); if (!showUsersSection && users.length === 0) loadUsers() }}
            >
              {showUsersSection ? '✕ Скрыть' : '👁 Показать'}
            </button>
          </div>

          {showUsersSection && (
            <div className="users-list">
              {usersLoading ? (
                <p>Загрузка пользователей...</p>
              ) : users.length === 0 ? (
                <p className="no-markers">Пользователей пока нет</p>
              ) : (
                <>
                  <p className="section-hint" style={{ marginBottom: '16px' }}>
                    Всего: {users.length} | Админов: {users.filter(u => u.is_admin).length}
                  </p>
                  {users.map(u => (
                    <div key={u.id} className={`user-item ${u.is_admin ? 'user-item--admin' : ''}`}>
                      <div className="user-info">
                        <div className="user-avatar">
                          {u.photo_url ? (
                            <img src={u.photo_url} alt={u.first_name} />
                          ) : (
                            <span>{u.first_name?.[0] || '?'}</span>
                          )}
                        </div>
                        <div className="user-details">
                          <strong>{u.first_name || ''} {u.last_name || ''}</strong>
                          <div className="user-meta">
                            {u.email && <span>📧 {u.email}</span>}
                            {u.phone && <span>📱 {u.phone}</span>}
                            {u.username && <span>@{u.username}</span>}
                            {u.telegram_id && <span>TG: {u.telegram_id}</span>}
                          </div>
                          <div className="user-meta">
                            <span>ID: {u.id}</span>
                            {u.created_at && <span>{new Date(u.created_at).toLocaleDateString('ru-RU')}</span>}
                            {u.is_admin && <span className="admin-badge">ADMIN</span>}
                          </div>
                        </div>
                      </div>
                      <div className="user-actions">
                        <button
                          className={u.is_admin ? 'btn-revoke' : 'btn-grant'}
                          onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                        >
                          {u.is_admin ? '🚫 Снять админа' : '👑 Назначить'}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
