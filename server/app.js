const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// إعداد قاعدة البيانات
const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('خطأ في الاتصال بقاعدة البيانات:', err.message);
    } else {
        console.log('تم الاتصال بقاعدة البيانات.');
    }
});

// إعداد الوسيط
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'am-pos-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true في الإنتاج مع HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, '..', 'public')));

// التحقق من المصادقة للصفحات المحمية
function requirePageAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    next();
}

// مسار الجذر - إعادة توجيه إلى تسجيل الدخول
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// حماية الصفحات الرئيسية
app.get('/admin.html', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.get('/cashier.html', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'cashier.html'));
});

app.get('/daily-sales.html', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'daily-sales.html'));
});

// مسار صفحة الدفع - إعادة توجيه إلى الكاشير (الدفع الآن في مودال)
app.get('/payment.html', requireAuth, (req, res) => {
    res.redirect('/cashier.html');
});

// مسار التحقق من رقم الموظف
app.post('/api/auth/check-employee', (req, res) => {
    const { employee_number } = req.body;

    db.get('SELECT id FROM employees WHERE employee_number = ?', [employee_number], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الخادم' });
        }

        if (!user) {
            return res.status(404).json({ error: 'رقم الموظف غير موجود' });
        }

        res.json({ success: true });
    });
});

// مسار المصادقة
app.post('/api/auth/login', (req, res) => {
    const { employee_number, password } = req.body;

    db.get('SELECT * FROM employees WHERE employee_number = ?', [employee_number], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في الخادم' });
        }

        if (!user) {
            return res.status(401).json({ error: 'رقم الموظف أو كلمة المرور غير صحيحة' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في الخادم' });
            }

            if (!isMatch) {
                return res.status(401).json({ error: 'رقم الموظف أو كلمة المرور غير صحيحة' });
            }

            req.session.user = {
                id: user.id,
                name: user.name,
                employee_number: user.employee_number,
                role: user.role
            };

            // إنشاء توكن JWT للأجهزة المحمولة
            const token = jwt.sign(
                {
                    id: user.id,
                    name: user.name,
                    employee_number: user.employee_number,
                    role: user.role
                },
                'am-pos-secret-key',
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                user: req.session.user,
                token: token,
                redirect: user.role === 'admin' ? '/admin.html' : '/cashier.html'
            });
        });
    });
});

// التحقق من المصادقة
app.get('/api/auth/check', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    }
    res.json({ success: true, user: req.session.user });
});



// مسار تسجيل الخروج
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في تسجيل الخروج' });
        }
        res.json({ success: true });
    });
});

// التحقق من المصادقة
function requireAuth(req, res, next) {
    // التحقق من التوكن JWT في الهيدر
    const token = req.headers['x-access-token'] || req.headers['authorization'];

    if (token) {
        jwt.verify(token, 'am-pos-secret-key', (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: 'توكن غير صحيح' });
            }
            req.user = decoded;
            next();
        });
    } else if (req.session.user) {
        // التحقق من الجلسة كبديل
        next();
    } else {
        return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    }
}

// التحقق من دور المدير
function requireAdmin(req, res, next) {
    // التحقق من التوكن JWT في الهيدر
    const token = req.headers['x-access-token'] || req.headers['authorization'];

    if (token) {
        jwt.verify(token, 'am-pos-secret-key', (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: 'توكن غير صحيح' });
            }
            if (decoded.role !== 'admin') {
                return res.status(403).json({ error: 'غير مصرح لك بالوصول' });
            }
            req.user = decoded;
            next();
        });
    } else if (req.session.user && req.session.user.role === 'admin') {
        // التحقق من الجلسة كبديل
        next();
    } else {
        return res.status(403).json({ error: 'غير مصرح لك بالوصول' });
    }
}

// مسارات المنتجات
app.get('/api/products', requireAuth, (req, res) => {
    db.all('SELECT * FROM products ORDER BY category, sort_order, name', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في استرجاع المنتجات' });
        }
        res.json(rows);
    });
});

app.post('/api/products', requireAuth, requireAdmin, (req, res) => {
    const { name, price, image_url, category } = req.body;

    if (!name || !price || !category) {
        return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }

    db.run('INSERT INTO products (name, price, image_url, category) VALUES (?, ?, ?, ?)',
        [name, price, image_url || '', category], function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطأ في إضافة المنتج' });
            }
            res.json({ success: true, id: this.lastID });
        });
});

app.put('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, price, image_url, category } = req.body;

    if (!name || !price || !category) {
        return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }

    db.run('UPDATE products SET name = ?, price = ?, image_url = ?, category = ? WHERE id = ?',
        [name, price, image_url || '', category, id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'خطأ في تحديث المنتج' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'المنتج غير موجود' });
            }
            res.json({ success: true });
        });
});

app.delete('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'خطأ في حذف المنتج' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'المنتج غير موجود' });
        }
        res.json({ success: true });
    });
});

// مسارات الموظفين
app.get('/api/employees', requireAuth, requireAdmin, (req, res) => {
    db.all('SELECT id, name, employee_number, role FROM employees ORDER BY name', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في استرجاع الموظفين' });
        }
        res.json(rows);
    });
});

app.post('/api/employees', requireAuth, requireAdmin, (req, res) => {
    const { name, employee_number, password, role } = req.body;

    if (!name || !employee_number || !password || !role) {
        return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }

    if (!['admin', 'cashier'].includes(role)) {
        return res.status(400).json({ error: 'الدور غير صحيح' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في تشفير كلمة المرور' });
        }

        db.run('INSERT INTO employees (name, employee_number, password, role) VALUES (?, ?, ?, ?)',
            [name, employee_number, hashedPassword, role], function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(400).json({ error: 'رقم الموظف موجود بالفعل' });
                    }
                    return res.status(500).json({ error: 'خطأ في إضافة الموظف' });
                }
                res.json({ success: true, id: this.lastID });
            });
    });
});

app.put('/api/employees/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, employee_number, password, role } = req.body;

    if (!name || !employee_number || !role) {
        return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }

    if (!['admin', 'cashier'].includes(role)) {
        return res.status(400).json({ error: 'الدور غير صحيح' });
    }

    const updateData = [name, employee_number, role, id];
    let query = 'UPDATE employees SET name = ?, employee_number = ?, role = ? WHERE id = ?';

    if (password) {
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في تشفير كلمة المرور' });
            }
            updateData.splice(2, 0, hashedPassword);
            query = 'UPDATE employees SET name = ?, employee_number = ?, password = ?, role = ? WHERE id = ?';

            db.run(query, updateData, function(err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(400).json({ error: 'رقم الموظف موجود بالفعل' });
                    }
                    return res.status(500).json({ error: 'خطأ في تحديث الموظف' });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'الموظف غير موجود' });
                }
                res.json({ success: true });
            });
        });
    } else {
        db.run(query, updateData, function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return res.status(400).json({ error: 'رقم الموظف موجود بالفعل' });
                }
                return res.status(500).json({ error: 'خطأ في تحديث الموظف' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'الموظف غير موجود' });
            }
            res.json({ success: true });
        });
    }
});

app.delete('/api/employees/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM employees WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'خطأ في حذف الموظف' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'الموظف غير موجود' });
        }
        res.json({ success: true });
    });
});

// مسار معالجة الدفع
app.post('/api/process-payment', requireAuth, (req, res) => {
    const { items, payments } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !payments || !Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }

    // التحقق من صحة طرق الدفع
    for (const payment of payments) {
        if (!payment.method || !['cash', 'card'].includes(payment.method) || typeof payment.amount !== 'number' || payment.amount <= 0) {
            return res.status(400).json({ error: 'طريقة الدفع أو المبلغ غير صحيح' });
        }
    }

    const total_amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total_paid = payments.reduce((sum, payment) => sum + payment.amount, 0);

    // التحقق من التطابق مع السماح بفرق صغير بسبب دقة الأرقام العشرية
    if (Math.abs(total_paid - total_amount) > 0.01) {
        return res.status(400).json({ 
            error: 'مجموع المبالغ المدفوعة لا يساوي إجمالي الفاتورة',
            details: {
                total_amount: total_amount.toFixed(2),
                total_paid: total_paid.toFixed(2),
                difference: (total_paid - total_amount).toFixed(2)
            }
        });
    }

    // تحديد طريقة الدفع العامة
    const cashPayments = payments.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0);
    const cardPayments = payments.filter(p => p.method === 'card').reduce((sum, p) => sum + p.amount, 0);

    let payment_method = 'cash';
    if (cashPayments > 0 && cardPayments > 0) {
        payment_method = 'mixed';
    } else if (cardPayments > 0) {
        payment_method = 'card';
    }

    // الحصول على التاريخ الحالي بتنسيق YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // الحصول على عدد الفواتير في اليوم الحالي لتحديد الرقم اليومي التالي
    db.get('SELECT COUNT(*) as count FROM invoices WHERE date(date) = ?', [today], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في استرجاع عدد الفواتير' });
        }

        const nextNumber = (row.count || 0) + 1;

        // إدراج الفاتورة مع الرقم اليومي
        const insertData = [req.session.user.id, total_amount, payment_method, cashPayments, cardPayments, JSON.stringify(payments), nextNumber];
        const insertQuery = 'INSERT INTO invoices (employee_id, total_amount, payment_method, cash_amount, card_amount, payments, daily_number) VALUES (?, ?, ?, ?, ?, ?, ?)';

        db.run(insertQuery, insertData, function(err) {
                if (err) {
                    console.error('خطأ في إنشاء الفاتورة:', err);
                    console.error('Query:', insertQuery);
                    console.error('Data:', insertData);
                    return res.status(500).json({ error: 'خطأ في إنشاء الفاتورة: ' + err.message });
                }

                const invoiceId = this.lastID;
                const insertItems = items.map(item =>
                    new Promise((resolve, reject) => {
                        db.run('INSERT INTO invoice_items (invoice_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                            [invoiceId, item.product_id, item.quantity, item.price], function(err) {
                                if (err) reject(err);
                                else resolve();
                            });
                    })
                );

                Promise.all(insertItems).then(() => {
                    res.json({
                        success: true,
                        invoice_id: invoiceId,
                        daily_number: nextNumber,
                        total_amount,
                        cash_amount: cashPayments,
                        card_amount: cardPayments,
                        payments
                    });
                }).catch(err => {
                    res.status(500).json({ error: 'خطأ في حفظ تفاصيل الفاتورة' });
                });
            });
    });
});

// مسارات الفواتير
app.post('/api/invoices', requireAuth, (req, res) => {
    const { items, payment_method, cash_amount, card_amount } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !payment_method) {
        return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }

    if (!['cash', 'card', 'mixed'].includes(payment_method)) {
        return res.status(400).json({ error: 'طريقة الدفع غير صحيحة' });
    }

    const total_amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // التحقق من صحة المبالغ في الدفع المختلط
    if (payment_method === 'mixed') {
        if (typeof cash_amount !== 'number' || typeof card_amount !== 'number' ||
            cash_amount < 0 || card_amount < 0 ||
            (cash_amount + card_amount) !== total_amount) {
            return res.status(400).json({ error: 'مبالغ الدفع المختلط غير صحيحة' });
        }
    }

    // الحصول على التاريخ الحالي بتنسيق YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // الحصول على عدد الفواتير في اليوم الحالي لتحديد الرقم اليومي التالي
    db.get('SELECT COUNT(*) as count FROM invoices WHERE date(date) = ?', [today], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في استرجاع عدد الفواتير' });
        }

        const nextNumber = (row.count || 0) + 1;

        // إدراج الفاتورة مع الرقم اليومي
        const insertData = [req.session.user.id, total_amount, payment_method, nextNumber];
        let insertQuery = 'INSERT INTO invoices (employee_id, total_amount, payment_method, daily_number) VALUES (?, ?, ?, ?)';

        if (payment_method === 'mixed') {
            insertData.splice(3, 0, cash_amount, card_amount);
            insertQuery = 'INSERT INTO invoices (employee_id, total_amount, payment_method, cash_amount, card_amount, daily_number) VALUES (?, ?, ?, ?, ?, ?)';
        }

        db.run(insertQuery, insertData, function(err) {
                if (err) {
                    return res.status(500).json({ error: 'خطأ في إنشاء الفاتورة' });
                }

                const invoiceId = this.lastID;
                const insertItems = items.map(item =>
                    new Promise((resolve, reject) => {
                        db.run('INSERT INTO invoice_items (invoice_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                            [invoiceId, item.product_id, item.quantity, item.price], function(err) {
                                if (err) reject(err);
                                else resolve();
                            });
                    })
                );

                Promise.all(insertItems).then(() => {
                    let responseData = { success: true, invoice_id: invoiceId, daily_number: nextNumber, total_amount };
                    if (payment_method === 'mixed') {
                        responseData.cash_amount = cash_amount;
                        responseData.card_amount = card_amount;
                    }
                    res.json(responseData);
                }).catch(err => {
                    res.status(500).json({ error: 'خطأ في حفظ تفاصيل الفاتورة' });
                });
            });
    });
});

// مسارات المبيعات اليومية
app.get('/api/daily-sales', requireAuth, (req, res) => {
    const now = new Date();
    const currentHour = now.getHours();

    // إذا كان الوقت 12 صباحاً، تصفير المبيعات
    const resetSales = currentHour === 0;

    const queryDate = now.toISOString().split('T')[0];

    if (resetSales) {
        // إذا كان الوقت 12 صباحاً، أعد مبيعات صفر
        res.json({
            date: queryDate,
            total_sales: 0,
            tax_amount: 0,
            net_sales: 0,
            total_invoices: 0,
            cash_sales: 0,
            card_sales: 0,
            reset_at_midnight: true,
            employee_sales: [],
            product_sales: []
        });
        return;
    }

    // الحصول على إجمالي المبيعات اليومية
    db.get(`
        SELECT
            COALESCE(SUM(total_amount), 0) as total_sales,
            COUNT(*) as total_invoices,
            COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN cash_amount ELSE 0 END), 0) as mixed_cash_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN card_amount ELSE 0 END), 0) as mixed_card_sales
        FROM invoices
        WHERE date(date) = ?
    `, [queryDate], (err, salesData) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في استرجاع المبيعات' });
        }

        const totalSales = salesData.total_sales || 0;
        const totalInvoices = salesData.total_invoices || 0;
        const taxAmount = totalSales * 0.15; // ضريبة 15%
        const netSales = totalSales - taxAmount;

        // حساب إجمالي المبيعات النقدية والبطاقة (بما في ذلك المختلط)
        const totalCashSales = (salesData.cash_sales || 0) + (salesData.mixed_cash_sales || 0);
        const totalCardSales = (salesData.card_sales || 0) + (salesData.mixed_card_sales || 0);

        // استرجاع مبيعات الموظفين
        db.all(`
            SELECT
                e.name as employee_name,
                SUM(i.total_amount) as total_sales,
                COUNT(i.id) as total_invoices
            FROM invoices i
            LEFT JOIN employees e ON i.employee_id = e.id
            WHERE date(i.date) = ?
            GROUP BY e.id, e.name
            ORDER BY total_sales DESC
        `, [queryDate], (err, employeeSales) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في استرجاع مبيعات الموظفين' });
            }
            if (err) {
                return res.status(500).json({ error: 'خطأ في استرجاع مبيعات الموظفين' });
            }

            // استرجاع مبيعات المنتجات
            db.all(`
                SELECT
                    p.name as product_name,
                    SUM(ii.quantity) as total_quantity,
                    SUM(ii.quantity * ii.price) as total_revenue
                FROM invoice_items ii
                LEFT JOIN products p ON ii.product_id = p.id
                LEFT JOIN invoices i ON ii.invoice_id = i.id
                WHERE date(i.date) = ?
                GROUP BY p.id, p.name
                ORDER BY total_revenue DESC
            `, [queryDate], (err, productSales) => {
                if (err) {
                    return res.status(500).json({ error: 'خطأ في استرجاع مبيعات المنتجات' });
                }

                res.json({
                    date: queryDate,
                    total_sales: totalSales,
                    tax_amount: taxAmount,
                    net_sales: netSales,
                    total_invoices: totalInvoices,
                    cash_sales: totalCashSales,
                    card_sales: totalCardSales,
                    reset_at_midnight: false,
                    employee_sales: employeeSales,
                    product_sales: productSales
                });
            });
        });
    });
});

// مسار إنهاء اليوم (للمدير فقط)
app.post('/api/close-day', requireAuth, requireAdmin, (req, res) => {

    const today = new Date().toISOString().split('T')[0];

    // التحقق من عدم إنهاء اليوم مسبقاً
    db.get('SELECT id FROM daily_closures WHERE date = ?', [today], (err, existingClosure) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في التحقق من إنهاء اليوم' });
        }

        if (existingClosure) {
            return res.status(400).json({ error: 'تم إنهاء اليوم مسبقاً' });
        }

        // الحصول على إجمالي المبيعات اليومية
        db.get(`
            SELECT
                COALESCE(SUM(total_amount), 0) as total_sales,
                COUNT(*) as total_invoices
            FROM invoices
            WHERE date(date) = ?
        `, [today], (err, salesData) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في استرجاع المبيعات' });
            }

            const totalSales = salesData.total_sales || 0;
            const totalInvoices = salesData.total_invoices || 0;
            const taxAmount = totalSales * 0.15;
            const netSales = totalSales - taxAmount;

            // إدراج إنهاء اليوم
            db.run(`
                INSERT INTO daily_closures (date, total_sales, total_tax, net_sales, total_invoices, closed_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [today, totalSales, taxAmount, netSales, totalInvoices, req.session.user.id], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'خطأ في إنهاء اليوم' });
                }

                // تصفير عداد الفواتير اليومية لليوم التالي
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];

                db.run('INSERT OR REPLACE INTO daily_invoice_counters (date, current_number) VALUES (?, 0)',
                    [tomorrowStr], (err) => {
                        if (err) {
                            console.error('خطأ في تصفير عداد الفواتير:', err);
                        }
                    });

                res.json({
                    success: true,
                    message: 'تم إنهاء اليوم بنجاح',
                    data: {
                        date: today,
                        total_sales: totalSales,
                        tax_amount: taxAmount,
                        net_sales: netSales,
                        total_invoices: totalInvoices
                    }
                });
            });
        });
    });
});

// مسار استرجاع يوم محدد (للمدير فقط)
app.post('/api/restore-day', requireAuth, requireAdmin, (req, res) => {
    const { date } = req.body;

    if (!date) {
        return res.status(400).json({ error: 'يجب تحديد التاريخ' });
    }

    // التحقق من صحة التاريخ
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
        return res.status(400).json({ error: 'تاريخ غير صحيح' });
    }

    const dateStr = selectedDate.toISOString().split('T')[0];

    // استرجاع بيانات اليوم من جدول الإغلاقات
    db.get(`
        SELECT * FROM daily_closures
        WHERE date = ?
        ORDER BY closed_at DESC
        LIMIT 1
    `, [dateStr], (err, closureData) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في استرجاع بيانات اليوم' });
        }

        if (!closureData) {
            return res.status(404).json({ error: 'لا توجد بيانات لهذا اليوم' });
        }

        // استرجاع الفواتير لهذا اليوم
        db.all(`
            SELECT
                i.*,
                e.name as employee_name,
                GROUP_CONCAT(ii.product_id || ':' || ii.quantity || ':' || ii.price, ';') as items
            FROM invoices i
            LEFT JOIN employees e ON i.employee_id = e.id
            LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
            WHERE date(i.date) = ?
            GROUP BY i.id
            ORDER BY i.daily_number
        `, [dateStr], (err, invoices) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في استرجاع الفواتير' });
            }

            res.json({
                success: true,
                closure: closureData,
                invoices: invoices
            });
        });
    });
});

// مسار استرجاع تفاصيل منتجات الفاتورة
app.get('/api/invoice-items/:invoiceId', requireAuth, (req, res) => {
    const { invoiceId } = req.params;

    db.all(`
        SELECT
            p.name as product_name,
            ii.quantity,
            ii.price
        FROM invoice_items ii
        LEFT JOIN products p ON ii.product_id = p.id
        WHERE ii.invoice_id = ?
        ORDER BY ii.id
    `, [invoiceId], (err, items) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في استرجاع تفاصيل الفاتورة' });
        }

        res.json({ items });
    });
});

// مسار استرجاع مبيعات تاريخ محدد
app.get('/api/sales-by-date', requireAuth, (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'يجب تحديد التاريخ' });
    }

    // التحقق من صحة التاريخ
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
        return res.status(400).json({ error: 'تاريخ غير صحيح' });
    }

    const dateStr = selectedDate.toISOString().split('T')[0];
    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();

    // إذا كان التاريخ المطلوب هو اليوم الحالي والوقت 12 صباحاً، تصفير المبيعات
    if (dateStr === currentDateStr && currentHour === 0) {
        res.json({
            date: dateStr,
            total_sales: 0,
            tax_amount: 0,
            net_sales: 0,
            total_invoices: 0,
            cash_sales: 0,
            card_sales: 0,
            reset_at_midnight: true,
            invoices: [],
            product_sales: [],
            employee_sales: []
        });
        return;
    }

    // الحصول على إجمالي المبيعات للتاريخ المحدد
    db.get(`
        SELECT
            COALESCE(SUM(total_amount), 0) as total_sales,
            COUNT(*) as total_invoices,
            COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN cash_amount ELSE 0 END), 0) as mixed_cash_sales,
            COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN card_amount ELSE 0 END), 0) as mixed_card_sales
        FROM invoices
        WHERE date(date) = ?
    `, [dateStr], (err, salesData) => {
        if (err) {
            return res.status(500).json({ error: 'خطأ في استرجاع المبيعات' });
        }

        const totalSales = salesData.total_sales || 0;
        const totalInvoices = salesData.total_invoices || 0;
        const taxAmount = totalSales * 0.15;
        const netSales = totalSales - taxAmount;
        
        // حساب إجمالي المبيعات النقدية والبطاقة (بما في ذلك المختلط)
        const totalCashSales = (salesData.cash_sales || 0) + (salesData.mixed_cash_sales || 0);
        const totalCardSales = (salesData.card_sales || 0) + (salesData.mixed_card_sales || 0);

        // استرجاع تفاصيل الفواتير
        db.all(`
            SELECT
                i.*,
                e.name as employee_name
            FROM invoices i
            LEFT JOIN employees e ON i.employee_id = e.id
            WHERE date(i.date) = ?
            ORDER BY i.daily_number
        `, [dateStr], (err, invoices) => {
            if (err) {
                return res.status(500).json({ error: 'خطأ في استرجاع الفواتير' });
            }

            // استرجاع مبيعات المنتجات
            db.all(`
                SELECT
                    p.name as product_name,
                    SUM(ii.quantity) as total_quantity,
                    SUM(ii.quantity * ii.price) as total_revenue
                FROM invoice_items ii
                LEFT JOIN products p ON ii.product_id = p.id
                LEFT JOIN invoices i ON ii.invoice_id = i.id
                WHERE date(i.date) = ?
                GROUP BY p.id, p.name
                ORDER BY total_revenue DESC
            `, [dateStr], (err, productSales) => {
                if (err) {
                    return res.status(500).json({ error: 'خطأ في استرجاع مبيعات المنتجات' });
                }

                // استرجاع مبيعات الموظفين
                db.all(`
                    SELECT
                        e.name as employee_name,
                        SUM(i.total_amount) as total_sales,
                        COUNT(i.id) as total_invoices
                    FROM invoices i
                    LEFT JOIN employees e ON i.employee_id = e.id
                    WHERE date(i.date) = ?
                    GROUP BY e.id, e.name
                    ORDER BY total_sales DESC
                `, [dateStr], (err, employeeSales) => {
                    if (err) {
                        return res.status(500).json({ error: 'خطأ في استرجاع مبيعات الموظفين' });
                    }

                    res.json({
                        date: dateStr,
                        total_sales: totalSales,
                        tax_amount: taxAmount,
                        net_sales: netSales,
                        total_invoices: totalInvoices,
                        cash_sales: totalCashSales,
                        card_sales: totalCardSales,
                        invoices: invoices,
                        product_sales: productSales,
                        employee_sales: employeeSales
                    });
                });
            });
        });
    });
});

// تشغيل الخادم
app.listen(PORT, HOST, () => {
    console.log(`الخادم يعمل على ${HOST}:${PORT}`);
    console.log(`يمكن الوصول للنظام من أي جهاز على الشبكة عبر: http://${HOST}:${PORT}`);
});
