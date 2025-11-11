document.addEventListener('DOMContentLoaded', function() {
    // عناصر DOM
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const logoutBtn = document.getElementById('logoutBtn');
    const dailySalesBtn = document.getElementById('dailySalesBtn');
    const userName = document.getElementById('userName');

    // مودال المنتجات
    const productModal = document.getElementById('productModal');
    const productForm = document.getElementById('productForm');
    const addProductBtn = document.getElementById('addProductBtn');
    const productModalTitle = document.getElementById('productModalTitle');

    // مودال الموظفين
    const employeeModal = document.getElementById('employeeModal');
    const employeeForm = document.getElementById('employeeForm');
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    const employeeModalTitle = document.getElementById('employeeModalTitle');

    // مودال التأكيد
    const confirmModal = document.getElementById('confirmModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    const loading = document.getElementById('loading');

    let currentEditingId = null;
    let currentDeleteType = null;
    let currentDeleteId = null;

    // دالة للحصول على رأس المصادقة
    function getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        return token ? { 'x-access-token': token } : {};
    }

    // التحقق من تسجيل الدخول
    checkAuth();

    // إعداد الأحداث
    setupEventListeners();

    // إعداد تبديل الوضع
    setupThemeToggle();

    // تحميل البيانات الأولية
    loadProducts();
    loadEmployees();

    // إعداد accordion المنتجات والموظفين
    setupAccordion();

    function setupEventListeners() {
        // تبديل التبويبات
        tabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // تسجيل الخروج
        logoutBtn.addEventListener('click', logout);

        // المبيعات اليومية
        if (dailySalesBtn) {
            dailySalesBtn.addEventListener('click', () => {
                openDailySalesModal();
            });
        }

        // مودال المنتجات
        addProductBtn.addEventListener('click', () => openProductModal());
        productForm.addEventListener('submit', handleProductSubmit);

        // مودال الموظفين
        addEmployeeBtn.addEventListener('click', () => openEmployeeModal());
        employeeForm.addEventListener('submit', handleEmployeeSubmit);

        // إغلاق المودال
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => closeAllModals());
        });

        // إلغاء في المودال
        document.querySelectorAll('.cancel-btn').forEach(cancelBtn => {
            cancelBtn.addEventListener('click', () => closeAllModals());
        });

        // تأكيد الحذف
        confirmDeleteBtn.addEventListener('click', confirmDelete);

        // إغلاق المودال عند النقر خارج المحتوى
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                closeAllModals();
            }
        });
    }

    function checkAuth() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            window.location.href = '/login.html';
            return;
        }

        // التحقق من صحة التوكن عبر API
        fetch('/api/auth/check', {
            method: 'GET',
            headers: {
                'x-access-token': token,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('توكن غير صحيح');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.user) {
                userName.textContent = `مرحباً، ${data.user.name}`;
            } else {
                throw new Error('بيانات المستخدم غير متوفرة');
            }
        })
        .catch(error => {
            console.error('خطأ في التحقق من المصادقة:', error);
            // مسح البيانات المحفوظة وإعادة التوجيه
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        });
    }

    function switchTab(tabName) {
        tabs.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    function logout() {
        fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        })
        .then(() => {
            window.location.href = '/login.html';
        })
        .catch(error => {
            console.error('خطأ في تسجيل الخروج:', error);
        });
    }

    // وظائف المنتجات
    function loadProducts() {
        showLoading();
        fetch('/api/products', {
            credentials: 'same-origin',
            headers: getAuthHeaders()
        })
        .then(response => response.json())
        .then(products => {
            displayProducts(products);
        })
        .catch(error => {
            console.error('خطأ في تحميل المنتجات:', error);
            showError('فشل في تحميل المنتجات');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function displayProducts(products) {
        const productsGrid = document.getElementById('productsGrid');
        productsGrid.innerHTML = '';

        if (products.length === 0) {
            productsGrid.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">لا توجد منتجات</p>';
            return;
        }

        // تحديث عدد المنتجات في العنوان
        const productsAccordionBtn = document.getElementById('productsAccordionBtn');
        if (productsAccordionBtn) {
            const span = productsAccordionBtn.querySelector('span');
            if (span) {
                span.textContent = `المنتجات (${products.length})`;
            }
        }

        products.forEach(product => {
            const productCard = createProductCard(product);
            productsGrid.appendChild(productCard);
        });
    }

    function createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-price">${product.price} ريال</div>
                <div class="product-category">${product.category}</div>
                <div class="product-actions">
                    <button class="edit-btn" data-id="${product.id}">تعديل</button>
                    <button class="delete-btn" data-id="${product.id}">حذف</button>
                </div>
            </div>
        `;

        // إضافة أحداث التعديل والحذف
        card.querySelector('.edit-btn').addEventListener('click', () => editProduct(product));
        card.querySelector('.delete-btn').addEventListener('click', () => deleteProduct(product.id));

        return card;
    }

    function openProductModal(product = null) {
        currentEditingId = product ? product.id : null;
        productModalTitle.textContent = product ? 'تعديل المنتج' : 'إضافة منتج جديد';

        if (product) {
            document.getElementById('productName').value = product.name;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productImage').value = product.image_url || '';
            document.getElementById('productCategory').value = product.category;
        } else {
            productForm.reset();
        }

        document.body.style.overflow = 'hidden';
        productModal.style.display = 'block';
    }

    function handleProductSubmit(e) {
        e.preventDefault();

        const formData = new FormData(productForm);
        const productData = {
            name: formData.get('name'),
            price: parseFloat(formData.get('price')),
            image_url: formData.get('image_url') || null,
            category: formData.get('category')
        };

        const url = currentEditingId ? `/api/products/${currentEditingId}` : '/api/products';
        const method = currentEditingId ? 'PUT' : 'POST';

        showLoading();
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(productData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeAllModals();
                loadProducts();
            } else {
                showError(data.error || 'فشل في حفظ المنتج');
            }
        })
        .catch(error => {
            console.error('خطأ في حفظ المنتج:', error);
            showError('حدث خطأ في حفظ المنتج');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function editProduct(product) {
        openProductModal(product);
    }

    function deleteProduct(id) {
        currentDeleteType = 'product';
        currentDeleteId = id;
        confirmModal.style.display = 'block';
    }

    // وظائف الموظفين
    function loadEmployees() {
        showLoading();
        fetch('/api/employees', {
            credentials: 'same-origin',
            headers: getAuthHeaders()
        })
        .then(response => response.json())
        .then(employees => {
            window.employees = employees; // حفظ قائمة الموظفين للتحقق
            displayEmployees(employees);
        })
        .catch(error => {
            console.error('خطأ في تحميل الموظفين:', error);
            showError('فشل في تحميل الموظفين');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function displayEmployees(employees) {
        const employeesList = document.getElementById('employeesList');
        employeesList.innerHTML = '';

        if (employees.length === 0) {
            employeesList.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">لا يوجد موظفون</p>';
            return;
        }

        // تحديث عدد الموظفين في العنوان
        const employeesAccordionBtn = document.getElementById('employeesAccordionBtn');
        if (employeesAccordionBtn) {
            const span = employeesAccordionBtn.querySelector('span');
            if (span) {
                span.textContent = `الموظفين (${employees.length})`;
            }
        }

        // عرض الموظفين في ثلاثة أعمدة
        const employeesGrid = document.createElement('div');
        employeesGrid.className = 'employees-grid';

        employees.forEach(employee => {
            const employeeCard = createEmployeeCard(employee);
            employeesGrid.appendChild(employeeCard);
        });

        employeesList.appendChild(employeesGrid);
    }

    function createEmployeeCard(employee) {
        const card = document.createElement('div');
        card.className = 'employee-card';
        const isAdmin = employee.role === 'admin';
        card.innerHTML = `
            <div class="employee-info">
                <h3>${employee.name}</h3>
                <div class="employee-details">
                    رقم الموظف: ${employee.employee_number}<br>
                    الدور: ${isAdmin ? 'مدير' : 'كاشير'}
                </div>
            </div>
            <div class="employee-actions">
                <button class="edit-btn" data-id="${employee.id}">تعديل</button>
                ${!isAdmin ? `<button class="delete-btn" data-id="${employee.id}">حذف</button>` : ''}
            </div>
        `;

        // إضافة أحداث التعديل والحذف
        card.querySelector('.edit-btn').addEventListener('click', () => editEmployee(employee));
        if (!isAdmin) {
            card.querySelector('.delete-btn').addEventListener('click', () => deleteEmployee(employee.id));
        }

        return card;
    }

    function openEmployeeModal(employee = null) {
        currentEditingId = employee ? employee.id : null;
        employeeModalTitle.textContent = employee ? 'تعديل الموظف' : 'إضافة موظف جديد';

        if (employee) {
            document.getElementById('employeeName').value = employee.name;
            document.getElementById('employeeNumber').value = employee.employee_number;
            document.getElementById('employeeRole').value = employee.role;
            // لا نعرض كلمة المرور عند التعديل
            document.getElementById('employeePassword').required = false;
            document.getElementById('employeePassword').value = '';
        } else {
            employeeForm.reset();
            document.getElementById('employeePassword').required = true;
        }

        // إضافة قيود على الحقول
        const employeeNumberInput = document.getElementById('employeeNumber');
        const employeePasswordInput = document.getElementById('employeePassword');

        // السماح بأرقام فقط في رقم الموظف وحد أقصى 4 أرقام
        employeeNumberInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, ''); // إزالة أي شيء غير رقم
            if (this.value.length > 4) {
                this.value = this.value.slice(0, 4); // حد أقصى 4 أرقام
            }
        });

        // السماح بأرقام فقط في كلمة المرور
        employeePasswordInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, ''); // إزالة أي شيء غير رقم
        });

        document.body.style.overflow = 'hidden';
        employeeModal.style.display = 'block';
    }

    function handleEmployeeSubmit(e) {
        e.preventDefault();

        const formData = new FormData(employeeForm);
        const employeeData = {
            name: formData.get('name'),
            employee_number: formData.get('employee_number'),
            role: formData.get('role')
        };

        // إضافة كلمة المرور فقط إذا كانت موجودة وغير فارغة
        const password = formData.get('password');
        if (password && password.trim() !== '') {
            employeeData.password = password;
        }

        const url = currentEditingId ? `/api/employees/${currentEditingId}` : '/api/employees';
        const method = currentEditingId ? 'PUT' : 'POST';

        showLoading();
        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(employeeData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeAllModals();
                loadEmployees();
            } else {
                showError(data.error || 'فشل في حفظ الموظف');
            }
        })
        .catch(error => {
            console.error('خطأ في حفظ الموظف:', error);
            showError('حدث خطأ في حفظ الموظف');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function editEmployee(employee) {
        openEmployeeModal(employee);
    }

    function deleteEmployee(id) {
        currentDeleteType = 'employee';
        currentDeleteId = id;
        confirmModal.style.display = 'block';
    }

    function confirmDelete() {
        if (!currentDeleteType || !currentDeleteId) return;

        const url = `/api/${currentDeleteType === 'product' ? 'products' : 'employees'}/${currentDeleteId}`;

        showLoading();
        fetch(url, {
            method: 'DELETE',
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                closeAllModals();
                if (currentDeleteType === 'product') {
                    loadProducts();
                } else {
                    loadEmployees();
                }
            } else {
                showError(data.error || 'فشل في الحذف');
            }
        })
        .catch(error => {
            console.error('خطأ في الحذف:', error);
            showError('حدث خطأ في الحذف');
        })
        .finally(() => {
            hideLoading();
            currentDeleteType = null;
            currentDeleteId = null;
        });
    }

    function closeAllModals() {
        productModal.style.display = 'none';
        employeeModal.style.display = 'none';
        confirmModal.style.display = 'none';
        dailySalesModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentEditingId = null;
    }

    // وظائف المبيعات اليومية
    function openDailySalesModal() {
        const modal = document.getElementById('dailySalesModal');
        const content = document.getElementById('dailySalesContent');

        // تحميل محتوى المبيعات اليومية
        content.innerHTML = `
            <div class="sales-container">
                <!-- ملخص المبيعات -->
                <div class="sales-summary">
                    <div class="summary-card">
                        <h3>المبيعات الإجمالية</h3>
                        <div class="amount" id="modalTotalSales">جاري التحميل...</div>
                    </div>
                    <div class="summary-card">
                        <h3>الضريبة (15%)</h3>
                        <div class="amount" id="modalTaxAmount">جاري التحميل...</div>
                    </div>
                    <div class="summary-card">
                        <h3>صافي المبيعات</h3>
                        <div class="amount" id="modalNetSales">جاري التحميل...</div>
                    </div>
                    <div class="summary-card">
                        <h3>عدد الفواتير</h3>
                        <div class="amount" id="modalTotalInvoices">جاري التحميل...</div>
                    </div>
                    <div class="summary-card">
                        <h3>المبيعات النقدية</h3>
                        <div class="amount" id="modalCashSales">جاري التحميل...</div>
                    </div>
                    <div class="summary-card">
                        <h3>المبيعات بالبطاقة</h3>
                        <div class="amount" id="modalCardSales">جاري التحميل...</div>
                    </div>
                </div>

                <!-- أزرار الإجراءات -->
                <div class="actions-section">
                    <button id="modalViewDateBtn" class="view-date-btn">عرض تاريخ محدد</button>
                </div>

                <!-- اختيار التاريخ -->
                <div class="date-selector" id="modalDateSelector" style="display: none;">
                    <label for="modalSalesDate">اختر التاريخ:</label>
                    <input type="date" id="modalSalesDate" name="modalSalesDate">
                    <button id="modalLoadDateBtn" class="load-date-btn">تحميل</button>
                </div>

                <!-- مبيعات المنتجات -->
                <div class="product-sales-section">
                    <div class="accordion-btn" id="modalProductSalesAccordionBtn">
                        <span>مبيعات المنتجات</span>
                        <span class="accordion-icon">▼</span>
                    </div>
                    <div class="accordion-content" id="modalProductSalesAccordionContent">
                        <div class="product-sales-list" id="modalProductSalesList">
                            <!-- سيتم إضافة مبيعات المنتجات هنا -->
                        </div>
                    </div>
                </div>

                <!-- مبيعات الموظفين -->
                <div class="employee-sales-section">
                    <div class="accordion-btn" id="modalEmployeeSalesAccordionBtn">
                        <span>مبيعات الموظفين</span>
                        <span class="accordion-icon">▼</span>
                    </div>
                    <div class="accordion-content" id="modalEmployeeSalesAccordionContent">
                        <div class="employee-sales-list" id="modalEmployeeSalesList">
                            <!-- سيتم إضافة مبيعات الموظفين هنا -->
                        </div>
                    </div>
                </div>

                <!-- قائمة الفواتير -->
                <div class="invoices-section">
                    <div class="accordion-btn" id="modalInvoicesAccordionBtn">
                        <span>تفاصيل الفواتير</span>
                        <span class="accordion-icon">▼</span>
                    </div>
                    <div class="accordion-content" id="modalInvoicesAccordionContent">
                        <div class="invoices-list" id="modalInvoicesList">
                            <p>جاري تحميل الفواتير...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // إعداد الأحداث للمودال
        setupModalEventListeners();

        // تحميل البيانات
        loadModalDailySales();

        // عرض المودال
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function setupModalEventListeners() {
        // زر عرض تاريخ محدد
        const viewDateBtn = document.getElementById('modalViewDateBtn');
        if (viewDateBtn) {
            viewDateBtn.addEventListener('click', () => toggleModalDateSelector());
        }

        // زر تحميل التاريخ
        const loadDateBtn = document.getElementById('modalLoadDateBtn');
        if (loadDateBtn) {
            loadDateBtn.addEventListener('click', () => loadModalSalesByDate());
        }

        // زر إغلاق المودال
        const closeBtn = document.getElementById('closeDailySalesModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeAllModals());
        }

        // إعداد accordion الفواتير في المودال
        const modalInvoicesAccordionBtn = document.getElementById('modalInvoicesAccordionBtn');
        const modalInvoicesAccordionContent = document.getElementById('modalInvoicesAccordionContent');

        if (modalInvoicesAccordionBtn && modalInvoicesAccordionContent) {
            modalInvoicesAccordionBtn.addEventListener('click', function() {
                const isOpen = modalInvoicesAccordionContent.classList.contains('open');
                if (isOpen) {
                    modalInvoicesAccordionContent.classList.remove('open');
                    this.classList.remove('active');
                } else {
                    modalInvoicesAccordionContent.classList.add('open');
                    this.classList.add('active');
                }
            });
        }

        // إعداد accordion مبيعات المنتجات في المودال
        const modalProductSalesAccordionBtn = document.getElementById('modalProductSalesAccordionBtn');
        const modalProductSalesAccordionContent = document.getElementById('modalProductSalesAccordionContent');

        if (modalProductSalesAccordionBtn && modalProductSalesAccordionContent) {
            modalProductSalesAccordionBtn.addEventListener('click', function() {
                const isOpen = modalProductSalesAccordionContent.classList.contains('open');
                if (isOpen) {
                    modalProductSalesAccordionContent.classList.remove('open');
                    this.classList.remove('active');
                } else {
                    modalProductSalesAccordionContent.classList.add('open');
                    this.classList.add('active');
                }
            });
        }

        // إعداد accordion مبيعات الموظفين في المودال
        const modalEmployeeSalesAccordionBtn = document.getElementById('modalEmployeeSalesAccordionBtn');
        const modalEmployeeSalesAccordionContent = document.getElementById('modalEmployeeSalesAccordionContent');

        if (modalEmployeeSalesAccordionBtn && modalEmployeeSalesAccordionContent) {
            modalEmployeeSalesAccordionBtn.addEventListener('click', function() {
                const isOpen = modalEmployeeSalesAccordionContent.classList.contains('open');
                if (isOpen) {
                    modalEmployeeSalesAccordionContent.classList.remove('open');
                    this.classList.remove('active');
                } else {
                    modalEmployeeSalesAccordionContent.classList.add('open');
                    this.classList.add('active');
                }
            });
        }
    }

    function loadModalDailySales() {
        fetch('/api/daily-sales', {
            method: 'GET',
            headers: getAuthHeaders()
        })
            .then(response => {
                console.log('استجابة API المبيعات اليومية في المدير:', response);
                return response.json();
            })
            .then(data => {
                console.log('بيانات المبيعات اليومية المستلمة في المدير:', data);
                if (data.error) {
                    alert('خطأ: ' + data.error);
                    return;
                }

                updateModalSalesSummary(data);
                loadModalInvoices();
            })
            .catch(error => {
                console.error('خطأ في تحميل المبيعات:', error);
                alert('حدث خطأ في تحميل البيانات');
            });
    }

    function updateModalSalesSummary(data) {
        console.log('تحديث ملخص المبيعات في المودال:', data);

        document.getElementById('modalTotalSales').textContent = data.total_sales.toFixed(2) + ' ريال';
        document.getElementById('modalTaxAmount').textContent = data.tax_amount.toFixed(2) + ' ريال';
        document.getElementById('modalNetSales').textContent = data.net_sales.toFixed(2) + ' ريال';
        document.getElementById('modalTotalInvoices').textContent = data.total_invoices;

        // تحديث المبيعات النقدية والبطاقة إذا كانت العناصر موجودة
        const cashSalesElement = document.getElementById('modalCashSales');
        const cardSalesElement = document.getElementById('modalCardSales');

        console.log('عنصر المبيعات النقدية في المودال:', cashSalesElement);
        console.log('عنصر المبيعات بالبطاقة في المودال:', cardSalesElement);
        console.log('قيمة cash_sales:', data.cash_sales);
        console.log('قيمة card_sales:', data.card_sales);

        if (cashSalesElement && data.cash_sales !== undefined) {
            cashSalesElement.textContent = data.cash_sales.toFixed(2) + ' ريال';
            console.log('تم تحديث المبيعات النقدية في المودال إلى:', cashSalesElement.textContent);
        }

        if (cardSalesElement && data.card_sales !== undefined) {
            cardSalesElement.textContent = data.card_sales.toFixed(2) + ' ريال';
            console.log('تم تحديث المبيعات بالبطاقة في المودال إلى:', cardSalesElement.textContent);
        }
    }

    function loadModalInvoices() {
        const today = new Date().toISOString().split('T')[0];

        fetch(`/api/sales-by-date?date=${today}`, {
            method: 'GET',
            headers: getAuthHeaders()
        })
            .then(response => {
                console.log('استجابة API الفواتير في المدير:', response);
                return response.json();
            })
            .then(data => {
                console.log('بيانات الفواتير المستلمة في المدير:', data);
                if (data.error) {
                    console.error('خطأ في تحميل الفواتير:', data.error);
                    return;
                }

                displayModalInvoices(data.invoices);
                displayModalEmployeeSales(data.employee_sales);
                displayModalProductSales(data.product_sales);
            })
            .catch(error => {
                console.error('خطأ في تحميل الفواتير:', error);
                alert('حدث خطأ في تحميل بيانات الفواتير');
            });
    }

    function displayModalInvoices(invoices) {
        const invoicesList = document.getElementById('modalInvoicesList');

        if (!invoices || invoices.length === 0) {
            invoicesList.innerHTML = '<p>لا توجد مبيعات في هذا اليوم</p>';
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
                    <span class="invoice-method">${invoice.payment_method === 'cash' ? 'نقدي' : invoice.payment_method === 'card' ? 'بطاقة' : 'مختلط'}</span>
                </div>
            </div>
        `).join('');

        invoicesList.innerHTML = invoicesHtml;
    }

    function displayModalEmployeeSales(employeeSales) {
        const employeeSalesList = document.getElementById('modalEmployeeSalesList');
        if (!employeeSalesList) return;

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

    function displayModalProductSales(productSales) {
        const productSalesList = document.getElementById('modalProductSalesList');
        if (!productSalesList) return;

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

    function toggleModalDateSelector() {
        const dateSelector = document.getElementById('modalDateSelector');
        dateSelector.style.display = dateSelector.style.display === 'none' ? 'block' : 'none';
    }

    function loadModalSalesByDate() {
        const dateInput = document.getElementById('modalSalesDate');
        const selectedDate = dateInput.value;

        if (!selectedDate) {
            alert('يرجى اختيار تاريخ');
            return;
        }

        fetch(`/api/sales-by-date?date=${selectedDate}`, {
            method: 'GET',
            headers: getAuthHeaders()
        })
            .then(response => {
                console.log('استجابة API المبيعات بالتاريخ في المدير:', response);
                return response.json();
            })
            .then(data => {
                console.log('بيانات المبيعات بالتاريخ المستلمة في المدير:', data);
                if (data.error) {
                    alert('خطأ: ' + data.error);
                    return;
                }

                updateModalSalesSummary(data);
                displayModalInvoices(data.invoices);
                displayModalEmployeeSales(data.employee_sales);
                displayModalProductSales(data.product_sales);
            })
            .catch(error => {
                console.error('خطأ في تحميل المبيعات:', error);
                alert('حدث خطأ في تحميل البيانات');
            });
    }



    function showLoading() {
        loading.style.display = 'flex';
    }

    function hideLoading() {
        loading.style.display = 'none';
    }

    function showError(message) {
        // يمكن إضافة تنبيه أو رسالة خطأ
        alert(message);
    }

    function setupThemeToggle() {
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', toggleTheme);
        }

        // تحميل الوضع المحفوظ
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            updateThemeIcon();
        }
    }

    function toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon();
    }

    function updateThemeIcon() {
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        if (themeToggleBtn) {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
        }
    }

    function setupAccordion() {
        // إعداد accordion المنتجات
        const productsAccordionBtn = document.getElementById('productsAccordionBtn');
        const productsAccordionContent = document.getElementById('productsAccordionContent');

        if (productsAccordionBtn && productsAccordionContent) {
            productsAccordionBtn.addEventListener('click', function() {
                const isOpen = productsAccordionContent.classList.contains('open');
                if (isOpen) {
                    productsAccordionContent.classList.remove('open');
                    this.classList.remove('active');
                } else {
                    productsAccordionContent.classList.add('open');
                    this.classList.add('active');
                }
            });
        }

        // إعداد accordion الموظفين
        const employeesAccordionBtn = document.getElementById('employeesAccordionBtn');
        const employeesAccordionContent = document.getElementById('employeesAccordionContent');

        if (employeesAccordionBtn && employeesAccordionContent) {
            employeesAccordionBtn.addEventListener('click', function() {
                const isOpen = employeesAccordionContent.classList.contains('open');
                if (isOpen) {
                    employeesAccordionContent.classList.remove('open');
                    this.classList.remove('active');
                } else {
                    employeesAccordionContent.classList.add('open');
                    this.classList.add('active');
                }
            });
        }

        // إعداد accordion الفواتير في المودال
        const modalInvoicesAccordionBtn = document.getElementById('modalInvoicesAccordionBtn');
        const modalInvoicesAccordionContent = document.getElementById('modalInvoicesAccordionContent');

        if (modalInvoicesAccordionBtn && modalInvoicesAccordionContent) {
            modalInvoicesAccordionBtn.addEventListener('click', function() {
                const isOpen = modalInvoicesAccordionContent.classList.contains('open');
                if (isOpen) {
                    modalInvoicesAccordionContent.classList.remove('open');
                    this.classList.remove('active');
                } else {
                    modalInvoicesAccordionContent.classList.add('open');
                    this.classList.add('active');
                }
            });
        }
    }
});
