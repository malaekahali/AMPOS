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
    fetch('/api/auth/check')
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                window.location.href = '/login.html';
                return;
            }

            document.getElementById('userName').textContent = data.user.name;

            // إظهار/إخفاء الأزرار حسب الدور
            if (data.user.role === 'admin') {
                document.getElementById('closeDayBtn').style.display = 'inline-block';
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

    // زر إنهاء اليوم
    document.getElementById('closeDayBtn').addEventListener('click', function() {
        showCloseDayModal();
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

    // مودال إنهاء اليوم
    document.getElementById('confirmCloseDayBtn').addEventListener('click', function() {
        closeDay();
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

    fetch('/api/daily-sales')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('خطأ: ' + data.error);
                return;
            }

            updateSalesSummary(data);
            loadInvoices();
        })
        .catch(error => {
            console.error('خطأ في تحميل المبيعات:', error);
            alert('حدث خطأ في تحميل البيانات');
        })
        .finally(() => {
            hideLoading();
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

    fetch(`/api/sales-by-date?date=${selectedDate}`)
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

    fetch(`/api/sales-by-date?date=${today}`)
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
    document.getElementById('totalSales').textContent = data.total_sales.toFixed(2) + ' ريال';
    document.getElementById('taxAmount').textContent = data.tax_amount.toFixed(2) + ' ريال';
    document.getElementById('netSales').textContent = data.net_sales.toFixed(2) + ' ريال';
    document.getElementById('totalInvoices').textContent = data.total_invoices;
    
    // تحديث المبيعات النقدية والبطاقة إذا كانت العناصر موجودة
    const cashSalesElement = document.getElementById('cashSales');
    const cardSalesElement = document.getElementById('cardSales');
    
    if (cashSalesElement && data.cash_sales !== undefined) {
        cashSalesElement.textContent = data.cash_sales.toFixed(2) + ' ريال';
    }
    
    if (cardSalesElement && data.card_sales !== undefined) {
        cardSalesElement.textContent = data.card_sales.toFixed(2) + ' ريال';
    }
}

function displayInvoices(invoices) {
    const invoicesList = document.getElementById('invoicesList');

    if (!invoices || invoices.length === 0) {
        invoicesList.innerHTML = '<p>لا توجد فواتير لهذا اليوم</p>';
        return;
    }

    const invoicesHtml = invoices.map(invoice => `
        <div class="invoice-item">
            <div class="invoice-header">
                <span class="invoice-number">فاتورة رقم ${invoice.daily_number}</span>
                <span class="invoice-time">${new Date(invoice.date).toLocaleTimeString('ar-SA')}</span>
                <span class="invoice-employee">${invoice.employee_name}</span>
            </div>
            <div class="invoice-details">
                <span class="invoice-amount">${invoice.total_amount.toFixed(2)} ريال</span>
                <span class="invoice-method">${invoice.payment_method === 'cash' ? 'نقدي' : 'بطاقة'}</span>
            </div>
        </div>
    `).join('');

    invoicesList.innerHTML = invoicesHtml;
}

function showCloseDayModal() {
    document.getElementById('closeDayModal').style.display = 'block';
}

function closeDay() {
    showLoading();

    fetch('/api/close-day', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('خطأ: ' + data.error);
            return;
        }

        alert('تم إنهاء اليوم بنجاح');
        document.getElementById('closeDayModal').style.display = 'none';
        loadDailySales(); // إعادة تحميل البيانات
    })
    .catch(error => {
        console.error('خطأ في إنهاء اليوم:', error);
        alert('حدث خطأ في إنهاء اليوم');
    })
    .finally(() => {
        hideLoading();
    });
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
    fetch('/api/auth/logout', { method: 'POST' })
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
