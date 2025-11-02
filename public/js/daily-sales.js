// إدارة المبيعات اليومية
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من المصادقة
    checkAuth();

    // تحميل البيانات الأولية
    loadDailySales();

    // إعداد الأحداث
    setupEventListeners();
});

function checkAuth() {
    fetch('/api/auth/check', { credentials: 'same-origin' })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                window.location.href = '/login.html';
                return;
            }

            document.getElementById('userName').textContent = data.user.name;

            // إظهار/إخفاء الأزرار حسب الدور
            if (data.user.role === 'admin') {
                document.getElementById('restoreDayBtn').style.display = 'inline-block';
            }
        })
        .catch(error => {
            console.error('خطأ في التحقق من المصادقة:', error);
            window.location.href = '/login.html';
        });
}

function setupEventListeners() {
    // زر العودة
    document.getElementById('backBtn').addEventListener('click', function() {
        window.history.back();
    });

    // زر تسجيل الخروج
    document.getElementById('logoutBtn').addEventListener('click', function() {
        logout();
    });



    // زر عرض تاريخ محدد
    document.getElementById('viewDateBtn').addEventListener('click', function() {
        toggleDateSelector();
    });

    // زر تحميل التاريخ
    document.getElementById('loadDateBtn').addEventListener('click', function() {
        loadSalesByDate();
    });

    // زر عودة يوم
    document.getElementById('restoreDayBtn').addEventListener('click', function() {
        showRestoreDayModal();
    });



    // مودال عودة يوم
    document.getElementById('confirmRestoreBtn').addEventListener('click', function() {
        restoreDay();
    });

    // إغلاق المودالات
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // إغلاق المودال عند النقر خارج المحتوى
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

function loadDailySales() {
    showLoading();

    fetch('/api/daily-sales', { credentials: 'same-origin' })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('خطأ: ' + data.error);
                return;
            }

            updateSalesSummary(data);
            loadInvoices();
            loadDailySalesData(); // تحميل بيانات الموظفين والمنتجات
        })
        .catch(error => {
            console.error('خطأ في تحميل المبيعات:', error);
            alert('حدث خطأ في تحميل البيانات');
        })
        .finally(() => {
            hideLoading();
        });
}

function loadDailySalesData() {
    const today = new Date().toISOString().split('T')[0];

    fetch(`/api/sales-by-date?date=${today}`, { credentials: 'same-origin' })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('خطأ في تحميل بيانات المبيعات اليومية:', data.error);
                return;
            }

            // عرض مبيعات الموظفين والمنتجات
            displayEmployeeSales(data.employee_sales);
            displayProductSales(data.product_sales);
        })
        .catch(error => {
            console.error('خطأ في تحميل بيانات المبيعات اليومية:', error);
        });
}

function loadSalesByDate() {
    const dateInput = document.getElementById('salesDate');
    const selectedDate = dateInput.value;

    if (!selectedDate) {
        alert('يرجى اختيار تاريخ');
        return;
    }

    showLoading();

    fetch(`/api/sales-by-date?date=${selectedDate}`, { credentials: 'same-origin' })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('خطأ: ' + data.error);
                return;
            }

            updateSalesSummary(data);
            displayInvoices(data.invoices);
        })
        .catch(error => {
            console.error('خطأ في تحميل المبيعات:', error);
            alert('حدث خطأ في تحميل البيانات');
        })
        .finally(() => {
            hideLoading();
        });
}

function loadInvoices() {
    const today = new Date().toISOString().split('T')[0];

    fetch(`/api/sales-by-date?date=${today}`, { credentials: 'same-origin' })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('خطأ في تحميل الفواتير:', data.error);
                return;
            }

            displayInvoices(data.invoices);
        })
        .catch(error => {
            console.error('خطأ في تحميل الفواتير:', error);
        });
}

function updateSalesSummary(data) {
    console.log('تحديث ملخص المبيعات:', data);

    document.getElementById('totalSales').textContent = data.total_sales.toFixed(2) + ' ريال';
    document.getElementById('taxAmount').textContent = data.tax_amount.toFixed(2) + ' ريال';
    document.getElementById('netSales').textContent = data.net_sales.toFixed(2) + ' ريال';
    document.getElementById('totalInvoices').textContent = data.total_invoices;

    // تحديث المبيعات النقدية والبطاقة إذا كانت العناصر موجودة
    const cashSalesElement = document.getElementById('cashSales');
    const cardSalesElement = document.getElementById('cardSales');

    console.log('عنصر المبيعات النقدية:', cashSalesElement);
    console.log('عنصر المبيعات بالبطاقة:', cardSalesElement);
    console.log('قيمة cash_sales:', data.cash_sales);
    console.log('قيمة card_sales:', data.card_sales);

    if (cashSalesElement && data.cash_sales !== undefined) {
        cashSalesElement.textContent = data.cash_sales.toFixed(2) + ' ريال';
        console.log('تم تحديث المبيعات النقدية إلى:', cashSalesElement.textContent);
    }

    if (cardSalesElement && data.card_sales !== undefined) {
        cardSalesElement.textContent = data.card_sales.toFixed(2) + ' ريال';
        console.log('تم تحديث المبيعات بالبطاقة إلى:', cardSalesElement.textContent);
    }

    // عرض مبيعات الموظفين
    displayEmployeeSales(data.employee_sales);

    // عرض مبيعات المنتجات
    displayProductSales(data.product_sales);
}

function displayInvoices(invoices) {
    const invoicesList = document.getElementById('invoicesList');

    if (!invoices || invoices.length === 0) {
        invoicesList.innerHTML = '<p>لا توجد مبيعات في هذا اليوم</p>';
        return;
    }

    const invoicesHtml = invoices.map(invoice => `
        <div class="invoice-item">
            <div class="invoice-header" onclick="toggleInvoiceDetails(this)">
                <span class="invoice-number">فاتورة رقم ${invoice.daily_number}</span>
                <span class="invoice-time">${new Date(invoice.date).toLocaleTimeString('ar-SA')}</span>
                <span class="invoice-employee">${invoice.employee_name}</span>
                <span class="invoice-toggle">▼</span>
            </div>
            <div class="invoice-details" style="display: none;">
                <div class="invoice-summary">
                    <span class="invoice-amount">${invoice.total_amount.toFixed(2)} ريال</span>
                    <span class="invoice-method">${invoice.payment_method === 'cash' ? 'نقدي' : invoice.payment_method === 'card' ? 'بطاقة' : 'مختلط'}</span>
                </div>
            </div>
        </div>
    `).join('');

    invoicesList.innerHTML = invoicesHtml;
}



function showRestoreDayModal() {
    document.getElementById('restoreDayModal').style.display = 'block';
}

function restoreDay() {
    const dateInput = document.getElementById('restoreDate');
    const selectedDate = dateInput.value;

    if (!selectedDate) {
        alert('يرجى اختيار تاريخ');
        return;
    }

    showLoading();

    fetch('/api/restore-day', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ date: selectedDate })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('خطأ: ' + data.error);
            return;
        }

        alert('تم استرجاع بيانات اليوم بنجاح');
        document.getElementById('restoreDayModal').style.display = 'none';
        loadSalesByDate(); // إعادة تحميل البيانات للتاريخ المحدد
    })
    .catch(error => {
        console.error('خطأ في استرجاع اليوم:', error);
        alert('حدث خطأ في استرجاع اليوم');
    })
    .finally(() => {
        hideLoading();
    });
}

function toggleDateSelector() {
    const dateSelector = document.getElementById('dateSelector');
    dateSelector.style.display = dateSelector.style.display === 'none' ? 'block' : 'none';
}

function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        .then(() => {
            window.location.href = '/login.html';
        })
        .catch(error => {
            console.error('خطأ في تسجيل الخروج:', error);
        });
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function displayEmployeeSales(employeeSales) {
    const employeeSalesList = document.getElementById('employeeSalesList');

    if (!employeeSales || employeeSales.length === 0) {
        employeeSalesList.innerHTML = '<p>لا توجد مبيعات موظفين في هذا اليوم</p>';
        return;
    }

    const employeeSalesHtml = employeeSales.map(employee => `
        <div class="employee-sale-item">
            <div class="employee-sale-header">
                <span class="employee-name">${employee.employee_name}</span>
                <span class="employee-invoices">${employee.total_invoices} فاتورة</span>
            </div>
            <div class="employee-sale-details">
                <span class="employee-revenue">${employee.total_sales.toFixed(2)} ريال</span>
            </div>
        </div>
    `).join('');

    employeeSalesList.innerHTML = employeeSalesHtml;
}

function displayProductSales(productSales) {
    const productSalesList = document.getElementById('productSalesList');

    if (!productSales || productSales.length === 0) {
        productSalesList.innerHTML = '<p>لا توجد مبيعات منتجات في هذا اليوم</p>';
        return;
    }

    const productSalesHtml = productSales.map(product => `
        <div class="product-sale-item">
            <div class="product-sale-header">
                <span class="product-name">${product.product_name}</span>
                <span class="product-quantity">تم بيع ${product.total_quantity} قطعة</span>
            </div>
            <div class="product-sale-details">
                <span class="product-revenue">${product.total_revenue.toFixed(2)} ريال</span>
            </div>
        </div>
    `).join('');

    productSalesList.innerHTML = productSalesHtml;
}

// دالة لتبديل عرض تفاصيل الفاتورة
function toggleInvoiceDetails(headerElement) {
    const invoiceItem = headerElement.parentElement;
    const detailsElement = invoiceItem.querySelector('.invoice-details');
    const toggleElement = headerElement.querySelector('.invoice-toggle');

    if (detailsElement.style.display === 'none' || detailsElement.style.display === '') {
        detailsElement.style.display = 'block';
        toggleElement.textContent = '▲';
    } else {
        detailsElement.style.display = 'none';
        toggleElement.textContent = '▼';
    }
}

// دالة لتحميل تفاصيل منتجات الفاتورة
function loadInvoiceItems(invoiceId) {
    const itemsContainer = document.getElementById(`invoice-items-${invoiceId}`);

    // إذا كانت التفاصيل محملة بالفعل، لا نحتاج لإعادة التحميل
    if (itemsContainer.innerHTML.trim() !== '<!-- سيتم تحميل تفاصيل المنتجات هنا -->') {
        return;
    }

    fetch(`/api/invoice-items/${invoiceId}`, { credentials: 'same-origin' })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                itemsContainer.innerHTML = '<p>خطأ في تحميل تفاصيل الفاتورة</p>';
                return;
            }

            if (!data.items || data.items.length === 0) {
                itemsContainer.innerHTML = '<p>لا توجد منتجات في هذه الفاتورة</p>';
                return;
            }

            const itemsHtml = data.items.map(item => `
                <div class="invoice-item-detail">
                    <span class="item-name">${item.product_name}</span>
                    <span class="item-quantity">${item.quantity} × ${item.price.toFixed(2)} ريال</span>
                    <span class="item-total">${(item.quantity * item.price).toFixed(2)} ريال</span>
                </div>
            `).join('');

            itemsContainer.innerHTML = itemsHtml;
        })
        .catch(error => {
            console.error('خطأ في تحميل تفاصيل الفاتورة:', error);
            itemsContainer.innerHTML = '<p>خطأ في تحميل التفاصيل</p>';
        });
}
