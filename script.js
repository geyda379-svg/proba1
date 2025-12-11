// Telegram Web App инициализация
const tg = window.Telegram.WebApp;
let cart = JSON.parse(localStorage.getItem('cart')) || {};
let products = [];

// Инициализация Telegram Web App
function initTelegramApp() {
    tg.expand();
    tg.enableClosingConfirmation();
    
    // Устанавливаем цвета из Telegram
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
    document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#999999');
    document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#2481cc');
    document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#40a7e3');
    document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
    document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f1f1f1');
    
    // Показываем информацию о пользователе
    if (tg.initDataUnsafe.user) {
        const user = tg.initDataUnsafe.user;
        document.getElementById('userCard').style.display = 'flex';
        document.getElementById('userName').textContent = `${user.first_name} ${user.last_name || ''}`;
        
        if (user.photo_url) {
            document.getElementById('userAvatar').src = user.photo_url;
        }
    }
    
    // Обработчик нажатия кнопки "Назад"
    tg.BackButton.onClick(() => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            tg.close();
        }
    });
}

// Загрузка продуктов с GitHub
async function loadProducts() {
    try {
        // Кэширование для избежания лимитов GitHub
        const cacheBuster = new Date().getTime();
        const response = await fetch(`https://raw.githubusercontent.com/ВАШ_ЛОГИН/telegram-webapp-store/main/products.json?t=${cacheBuster}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        products = await response.json();
        displayProducts(products);
        updateCartBadge();
        
        // Сохраняем в localStorage для офлайн-режима
        localStorage.setItem('products_cache', JSON.stringify(products));
        localStorage.setItem('products_cache_time', new Date().getTime());
        
    } catch (error) {
        console.error('Ошибка загрузки продуктов:', error);
        
        // Пробуем загрузить из кэша
        const cachedProducts = localStorage.getItem('products_cache');
        const cacheTime = localStorage.getItem('products_cache_time');
        
        if (cachedProducts && cacheTime && (new Date().getTime() - cacheTime < 5 * 60 * 1000)) {
            products = JSON.parse(cachedProducts);
            displayProducts(products);
            showNotification('Используем кэшированные данные', 'warning');
        } else {
            document.getElementById('emptyState').style.display = 'block';
            document.getElementById('productsContainer').innerHTML = '';
            showNotification('Ошибка загрузки товаров', 'error');
        }
    }
}

// Отображение продуктов
function displayProducts(productsList) {
    const container = document.getElementById('productsContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (!productsList || productsList.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = '';
    
    productsList.forEach(product => {
        const productElement = createProductElement(product);
        container.appendChild(productElement);
    });
}

// Создание элемента продукта
function createProductElement(product) {
    const div = document.createElement('div');
    div.className = 'product-card';
    div.innerHTML = `
        <div class="product-image">
            <i class="${getProductIcon(product.category)}"></i>
        </div>
        <div class="product-content">
            <h3 class="product-title">${escapeHtml(product.name)}</h3>
            <p class="product-description">${escapeHtml(product.description)}</p>
            <div class="product-price">${formatPrice(product.price)}</div>
            <div class="product-actions">
                <button class="tg-btn secondary" onclick="showProductDetail('${product.id}')">
                    <i class="fas fa-info-circle"></i> Подробно
                </button>
                <button class="tg-btn primary" onclick="addToCart('${product.id}')">
                    <i class="fas fa-cart-plus"></i> В корзину
                </button>
            </div>
        </div>
    `;
    return div;
}

// Добавление в корзину
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (!cart[productId]) {
        cart[productId] = {
            ...product,
            quantity: 1
        };
    } else {
        cart[productId].quantity += 1;
    }
    
    saveCart();
    updateCartBadge();
    showNotification(`${product.name} добавлен в корзину`, 'success');
    
    // Вибрация (если поддерживается)
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
}

// Сохранение корзины
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Обновление бейджа корзины
function updateCartBadge() {
    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = totalItems;
}

// Показать корзину
function showCart() {
    const modal = document.getElementById('cartModal');
    const itemsContainer = document.getElementById('cartItems');
    const totalElement = document.getElementById('cartTotal');
    
    if (Object.keys(cart).length === 0) {
        itemsContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart" style="font-size: 48px; color: #ccc; margin-bottom: 16px;"></i>
                <p>Корзина пуста</p>
            </div>
        `;
        totalElement.textContent = '0 ₽';
    } else {
        let total = 0;
        itemsContainer.innerHTML = '';
        
        Object.values(cart).forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            itemElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee;">
                    <div>
                        <strong>${escapeHtml(item.name)}</strong>
                        <p style="color: #666; font-size: 14px;">${formatPrice(item.price)} × ${item.quantity}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; margin-bottom: 8px;">${formatPrice(itemTotal)}</div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="updateQuantity('${item.id}', -1)" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #ddd; background: white;">-</button>
                            <span style="min-width: 30px; text-align: center;">${item.quantity}</span>
                            <button onclick="updateQuantity('${item.id}', 1)" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #ddd; background: white;">+</button>
                        </div>
                    </div>
                </div>
            `;
            itemsContainer.appendChild(itemElement);
        });
        
        totalElement.textContent = formatPrice(total);
    }
    
    modal.style.display = 'flex';
}

// Обновление количества товара
function updateQuantity(productId, change) {
    if (!cart[productId]) return;
    
    cart[productId].quantity += change;
    
    if (cart[productId].quantity <= 0) {
        delete cart[productId];
    }
    
    saveCart();
    updateCartBadge();
    showCart();
}

// Оформление заказа
function checkout() {
    if (Object.keys(cart).length === 0) {
        showNotification('Корзина пуста', 'error');
        return;
    }
    
    const order = {
        id: 'order_' + Date.now(),
        date: new Date().toISOString(),
        items: cart,
        total: Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0),
        userId: tg.initDataUnsafe.user?.id || 'anonymous',
        status: 'pending'
    };
    
    // В реальном приложении здесь будет отправка на сервер
    showNotification('Заказ оформлен!', 'success');
    
    // Очищаем корзину
    cart = {};
    saveCart();
    updateCartBadge();
    closeModal('cartModal');
    
    // Сохраняем заказ в историю
    saveOrder(order);
}

// Вспомогательные функции
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0
    }).format(price);
}

function getProductIcon(category) {
    const icons = {
        'electronics': 'fas fa-laptop',
        'clothes': 'fas fa-tshirt',
        'books': 'fas fa-book',
        'food': 'fas fa-utensils',
        'other': 'fas fa-box'
    };
    return icons[category] || 'fas fa-box';
}

function showNotification(message, type = 'info') {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Анимация
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        tg.close();
    }
}

function toggleMenu() {
    // Здесь можно добавить боковое меню
    showNotification('Меню будет добавлено в будущем', 'info');
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    initTelegramApp();
    loadProducts();
    updateCartBadge();
    
    // Автообновление каждые 30 секунд
    setInterval(loadProducts, 30000);
    
    // Обработчик для обновления при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            loadProducts();
        }
    });
});