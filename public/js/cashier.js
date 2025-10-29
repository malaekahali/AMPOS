document.addEventListener('DOMContentLoaded', function() {
    // عناصر DOM
    const logoutBtn = document.getElementById('logoutBtn');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const dailySalesBtn = document.getElementById('dailySalesBtn');
    const userName = document.getElementById('userName');
    const productsGrid = document.getElementById('productsGrid');
    const cartItems = document.getElementById('cartItems');
    const totalAmount = document.getElementById('totalAmount');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const categoryBtns = document.querySelectorAll('.category-btn');
    const receiptModal = document.getElementById('receiptModal');
    const receiptContent = document.getElementById('receiptContent');
    const printReceiptBtn = document.getElementById('printReceiptBtn');
    const newSaleBtn = document.getElementById('newSaleBtn');
    const paymentModal = document.getElementById('paymentModal');
    const dailySalesModal = document.getElementById('dailySalesModal');
    const loading = document.getElementById('loading');

    let products = [];
    let cart = [];

    // التحقق من تسجيل الدخول
    checkAuth();

    // إعداد الأحداث
    setupEventListeners();

    // تحميل المنتجات
    loadProducts();

    function setupEventListeners() {
        logoutBtn.addEventListener('click', logout);
        themeToggleBtn.addEventListener('click', toggleTheme);
        if (dailySalesBtn) {
            dailySalesBtn.addEventListener('click', openDailySalesModal);
        }
        categoryBtns.forEach(btn => {
            btn.addEventListener('click', () => filterProducts(btn.dataset.category));
        });
        clearCartBtn.addEventListener('click', clearCart);
        checkoutBtn.addEventListener('click', openPaymentModal);
        printReceiptBtn.addEventListener('click', () => window.print());
        newSaleBtn.addEventListener('click', closeAllModals);
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', closeAllModals);
        });
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                if (e.target.id === 'paymentModal') {
                    e.target.classList.add('alert');
                    setTimeout(() => e.target.classList.remove('alert'), 500);
                    return;
                }
                closeAllModals();
            }
        });
    }

    function checkAuth() {
        fetch('/api/auth/check', { credentials: 'same-origin' })
        .then(response => {
            if (!response.ok) {
                window.location.href = '/login.html';
                return;
            }
            return response.json();
        })
        .then(data => {
            if (data && data.user) {
                userName.textContent = `مرحباً، ${data.user.name}`;
            }
        })
        .catch(() => window.location.href = '/login.html');
    }

    function logout() {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        .then(() => window.location.href = '/login.html')
        .catch(error => console.error('خطأ في تسجيل الخروج:', error));
    }

    function loadProducts() {
        loading.style.display = 'flex';
        fetch('/api/products', { credentials: 'same-origin' })
        .then(response => response.json())
        .then(data => {
            products = data;
            displayProducts(products);
        })
        .catch(error => {
            console.error('خطأ في تحميل المنتجات:', error);
            alert('فشل في تحميل المنتجات');
        })
        .finally(() => loading.style.display = 'none');
    }

    function displayProducts(productsToShow) {
        if (productsToShow.length === 0) {
            productsGrid.innerHTML = '<p style="text-align: center; color: #666; font-style: italic; grid-column: 1 / -1;">لا توجد منتجات في هذا التصنيف</p>';
            return;
        }
        productsGrid.innerHTML = productsToShow.map(product => `
            <div class="product-card" onclick="window.addToCart(${product.id})">
                <div class="product-image">${product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : '☕'}</div>
                <div class="product-name">${product.name}</div>
                <div class="product-size">${product.size}</div>
                <div class="product-price">${product.price} ر.س</div>
            </div>
        `).join('');
    }

    window.addToCart = function(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const existingItem = cart.find(item => item.product_id === product.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                product_id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1
            });
        }
        updateCartDisplay();
    }

    function filterProducts(category) {
        categoryBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        const filteredProducts = category === 'all' ? products : products.filter(p => p.category === category);
        displayProducts(filteredProducts);
    }

    function updateCartDisplay() {
        if (cart.length === 0) {
            cartItems.innerHTML = '<div class="empty-cart"><span>🛒</span><p>السلة فارغة</p></div>';
            checkoutBtn.disabled = true;
            totalAmount.textContent = '0.00 ر.س';
            return;
        }

        cartItems.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${item.price} ر.س × ${item.quantity}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="quantity-btn minus" onclick="window.changeQuantity(${index}, -1)">-</button>
                    <span class="cart-item-quantity">${item.quantity}</span>
                    <button class="quantity-btn plus" onclick="window.changeQuantity(${index}, 1)">+</button>
                    <button class="remove-item" onclick="window.removeFromCart(${index})">×</button>
                </div>
            </div>
        `).join('');

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalAmount.textContent = `${total.toFixed(2)} ر.س`;
        checkoutBtn.disabled = false;
    }

    window.changeQuantity = function(index, change) {
        cart[index].quantity += change;
        if (cart[index].quantity <= 0) {
            cart.splice(index, 1);
        }
        updateCartDisplay();
    }

    window.removeFromCart = function(index) {
        cart.splice(index, 1);
        updateCartDisplay();
    }

    function clearCart() {
        if (cart.length === 0) return;
        if (confirm('هل أنت متأكد من مسح جميع العناصر من السلة؟')) {
            cart = [];
            updateCartDisplay();
        }
    }

    function openPaymentModal() {
        if (cart.length === 0) return;

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        document.getElementById('paymentContent').innerHTML = `
            <div class="payment-container">
                <div class="payment-main">
                    <div class="payment-left">
                        <div class="total-display">
                            <div class="remaining-amount">
                                <span>المبلغ المتبقي:</span>
                                <span id="remainingAmountDisplay">${total.toFixed(2)} ر.س</span>
                            </div>
                            <div class="paid-amounts">
                                <div class="paid-amount"><span>مدفوع نقدي:</span><span id="cashPaidDisplay">0.00 ر.س</span></div>
                                <div class="paid-amount"><span>مدفوع بطاقة:</span><span id="cardPaidDisplay">0.00 ر.س</span></div>
                                <div class="paid-amount total-paid"><span>المجموع المدفوع:</span><span id="totalPaidDisplay">0.00 ر.س</span></div>
                            </div>
                        </div>
                        <div class="payment-buttons">
                            <button id="cashPaymentBtn" class="payment-btn cash-btn">💰 الدفع نقدي</button>
                            <button id="cardPaymentBtn" class="payment-btn card-btn">💳 الدفع بالبطاقة</button>
                            <button id="cancelPaymentBtn" class="payment-btn cancel-btn">❌ إلغاء</button>
                            <button id="confirmPaymentBtn" class="payment-btn confirm-btn" disabled>✅ تأكيد الدفع</button>
                        </div>
                    </div>
                    <div class="payment-right">
                        <div class="numpad-section">
                            <div class="numpad" style="transform: scale(0.9); width: 250px;">
                                <div class="numpad-display"><input type="text" id="numpadInput" readonly value="0.00"></div>
                                <div class="numpad-buttons" style="grid-template-columns: repeat(3, 1fr);">
                                    ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="numpad-btn" data-value="${n}">${n}</button>`).join('')}
                                    <button class="numpad-btn" data-value=".">.</button>
                                    <button class="numpad-btn" data-value="0">0</button>
                                    <button class="numpad-btn" data-action="clear">CL</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        setupPaymentModalEvents(total);
        paymentModal.style.display = 'block';
        paymentModal.style.overflow = 'hidden';
    }

    function setupPaymentModalEvents(total) {
        let remainingAmount = total, cashAmount = 0, cardAmount = 0;
        
        const updateDisplays = () => {
            document.getElementById('remainingAmountDisplay').textContent = `${remainingAmount.toFixed(2)} ر.س`;
            document.getElementById('cashPaidDisplay').textContent = `${cashAmount.toFixed(2)} ر.س`;
            document.getElementById('cardPaidDisplay').textContent = `${cardAmount.toFixed(2)} ر.س`;
            document.getElementById('totalPaidDisplay').textContent = `${(cashAmount + cardAmount).toFixed(2)} ر.س`;
            document.getElementById('confirmPaymentBtn').disabled = remainingAmount > 0;
        };

        document.querySelectorAll('.numpad-btn').forEach(button => {
            button.addEventListener('click', () => {
                const input = document.getElementById('numpadInput');
                const action = button.dataset.action;
                const value = button.dataset.value;
                
                if (action === 'clear') {
                    input.value = '0.00';
                } else {
                    input.value = input.value === '0.00' ? value : input.value + value;
                }
            });
        });

        document.getElementById('cashPaymentBtn').addEventListener('click', () => {
            const amount = parseFloat(document.getElementById('numpadInput').value) || 0;
            if (amount <= 0 || amount > remainingAmount) {
                alert(amount <= 0 ? 'يرجى إدخال مبلغ صحيح' : 'المبلغ المدخل أكبر من المبلغ المتبقي');
                return;
            }
            cashAmount += amount;
            remainingAmount -= amount;
            document.getElementById('numpadInput').value = '0.00';
            updateDisplays();
        });

        document.getElementById('cardPaymentBtn').addEventListener('click', () => {
            const amount = parseFloat(document.getElementById('numpadInput').value) || 0;
            if (amount <= 0 || amount > remainingAmount) {
                alert(amount <= 0 ? 'يرجى إدخال مبلغ صحيح' : 'المبلغ المدخل أكبر من المبلغ المتبقي');
                return;
            }
            cardAmount += amount;
            remainingAmount -= amount;
            document.getElementById('numpadInput').value = '0.00';
            updateDisplays();
        });

        document.getElementById('confirmPaymentBtn').addEventListener('click', () => {
            const method = cashAmount > 0 && cardAmount > 0 ? 'mixed' : cardAmount > 0 ? 'card' : 'cash';
            processPayment(method, cashAmount, cardAmount);
        });

        document.getElementById('cancelPaymentBtn').addEventListener('click', closeAllModals);
    }

    function processPayment(method, cashAmount, cardAmount) {
        loading.style.display = 'flex';
        const payments = [];
        if (cashAmount > 0) payments.push({ method: 'cash', amount: cashAmount });
        if (cardAmount > 0) payments.push({ method: 'card', amount: cardAmount });

        fetch('/api/process-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ items: cart, payments: payments })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeAllModals();
                const currentCart = [...cart];
                cart = [];
                updateCartDisplay();
                showReceipt(data.invoice_id, data.total_amount, method, cashAmount, cardAmount, currentCart);
            } else {
                alert('خطأ في معالجة الدفع: ' + (data.error || 'خطأ غير معروف'));
            }
        })
        .catch(error => {
            console.error('خطأ في معالجة الدفع:', error);
            alert('حدث خطأ في معالجة الدفع');
        })
        .finally(() => loading.style.display = 'none');
    }

    function showReceipt(invoiceId, total, paymentMethod, cashAmount, cardAmount, cartItems) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('ar-SA') + ' ' + now.toLocaleTimeString('ar-SA');
        let paymentMethodText = paymentMethod === 'cash' ? 'نقدي' : paymentMethod === 'card' ? 'بطاقة ائتمان' : 'مختلط';
        if (paymentMethod === 'mixed') {
            paymentMethodText += ` (نقدي: ${cashAmount.toFixed(2)} ر.س، بطاقة: ${cardAmount.toFixed(2)} ر.س)`;
        }

        receiptContent.innerHTML = `
            <div class="receipt-header">
                <h4>AM POS - إيصال</h4>
                <div class="receipt-date">${dateStr}</div>
                <div>رقم الفاتورة: ${invoiceId}</div>
            </div>
            ${cartItems.map(item => `
                <div class="receipt-item">
                    <span>${item.name} × ${item.quantity}</span>
                    <span>${(item.price * item.quantity).toFixed(2)} ر.س</span>
                </div>
            `).join('')}
            <div class="receipt-total"><span>المجموع: ${total.toFixed(2)} ر.س</span></div>
            <div class="receipt-item"><span>طريقة الدفع: ${paymentMethodText}</span></div>
        `;
        receiptModal.style.display = 'block';
    }

    function closeAllModals() {
        receiptModal.style.display = 'none';
        paymentModal.style.display = 'none';
        dailySalesModal.style.display = 'none';
    }

    function openDailySalesModal() {
        document.getElementById('dailySalesContent').innerHTML = `
            <div class="sales-container">
                <div class="sales-summary">
                    ${['المبيعات الإجمالية', 'المبيعات النقدية', 'المبيعات بالبطاقة', 'الضريبة (15%)', 'صافي المبيعات', 'عدد الفواتير'].map((title, i) => `
                        <div class="summary-card">
                            <h3>${title}</h3>
                            <div class="amount" id="modal${['TotalSales', 'CashSales', 'CardSales', 'TaxAmount', 'NetSales', 'TotalInvoices'][i]}">جاري التحميل...</div>
                        </div>
                    `).join('')}
                </div>
                <div class="actions-section"><button id="modalViewDateBtn" class="view-date-btn">عرض تاريخ محدد</button></div>
                <div class="date-selector" id="modalDateSelector" style="display: none;">
                    <label for="modalSalesDate">اختر التاريخ:</label>
                    <input type="date" id="modalSalesDate">
                    <button id="modalLoadDateBtn" class="load-date-btn">تحميل</button>
                </div>
                <div class="invoices-section">
                    <h3>تفاصيل الفواتير</h3>
                    <div class="invoices-list" id="modalInvoicesList"><p>جاري تحميل الفواتير...</p></div>
                </div>
            </div>
        `;

        document.getElementById('modalViewDateBtn').addEventListener('click', () => {
            const selector = document.getElementById('modalDateSelector');
            selector.style.display = selector.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('modalLoadDateBtn').addEventListener('click', () => {
            const date = document.getElementById('modalSalesDate').value;
            if (!date) {
                alert('يرجى اختيار تاريخ');
                return;
            }
            loadSalesByDate(date);
        });

        document.getElementById('closeDailySalesModal').addEventListener('click', closeAllModals);

        fetch('/api/daily-sales')
            .then(response => response.json())
            .then(data => {
                if (!data.error) {
                    updateSalesSummary(data);
                    loadTodayInvoices();
                }
            })
            .catch(error => console.error('خطأ في تحميل المبيعات:', error));

        dailySalesModal.style.display = 'block';
    }

    function updateSalesSummary(data) {
        document.getElementById('modalTotalSales').textContent = data.total_sales.toFixed(2) + ' ريال';
        document.getElementById('modalTaxAmount').textContent = data.tax_amount.toFixed(2) + ' ريال';
        document.getElementById('modalNetSales').textContent = data.net_sales.toFixed(2) + ' ريال';
        document.getElementById('modalTotalInvoices').textContent = data.total_invoices;
        if (data.cash_sales !== undefined) document.getElementById('modalCashSales').textContent = data.cash_sales.toFixed(2) + ' ريال';
        if (data.card_sales !== undefined) document.getElementById('modalCardSales').textContent = data.card_sales.toFixed(2) + ' ريال';
    }

    function loadTodayInvoices() {
        const today = new Date().toISOString().split('T')[0];
        loadSalesByDate(today);
    }

    function loadSalesByDate(date) {
        fetch(`/api/sales-by-date?date=${date}`)
            .then(response => response.json())
            .then(data => {
                if (!data.error) {
                    updateSalesSummary(data);
                    displayInvoices(data.invoices);
                }
            })
            .catch(error => console.error('خطأ في تحميل الفواتير:', error));
    }

    function displayInvoices(invoices) {
        const list = document.getElementById('modalInvoicesList');
        if (!invoices || invoices.length === 0) {
            list.innerHTML = '<p>لا توجد فواتير لهذا اليوم</p>';
            return;
        }

        list.innerHTML = invoices.map(inv => `
            <div class="invoice-item">
                <div class="invoice-header">
                    <span class="invoice-number">فاتورة رقم ${inv.daily_number}</span>
                    <span class="invoice-time">${new Date(inv.date).toLocaleTimeString('ar-SA')}</span>
                    <span class="invoice-employee">${inv.employee_name}</span>
                </div>
                <div class="invoice-details">
                    <span class="invoice-amount">${inv.total_amount.toFixed(2)} ريال</span>
                    <span class="invoice-method">${inv.payment_method === 'cash' ? 'نقدي' : inv.payment_method === 'card' ? 'بطاقة' : 'مختلط'}</span>
                </div>
            </div>
        `).join('');
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        themeToggleBtn.title = newTheme === 'dark' ? 'تبديل إلى الوضع الفاتح' : 'تبديل إلى الوضع المظلم';
    }

    // تحميل الوضع المحفوظ
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    themeToggleBtn.title = savedTheme === 'dark' ? 'تبديل إلى الوضع الفاتح' : 'تبديل إلى الوضع المظلم';
});
