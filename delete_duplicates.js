const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('خطأ في الاتصال بقاعدة البيانات:', err.message);
        return;
    }
    console.log('تم الاتصال بقاعدة البيانات بنجاح.');
});

// العثور على المنتجات المتكررة
db.all('SELECT name, COUNT(*) as count FROM products GROUP BY name HAVING COUNT(*) > 1', [], (err, rows) => {
    if (err) {
        console.error('خطأ في العثور على المنتجات المتكررة:', err.message);
        db.close();
        return;
    }

    if (rows.length === 0) {
        console.log('لا توجد منتجات متكررة.');
        db.close();
        return;
    }

    console.log('المنتجات المتكررة:');
    rows.forEach(row => {
        console.log(`الاسم: ${row.name}, العدد: ${row.count}`);
    });

    // حذف المنتجات المتكررة، الاحتفاظ بالسجل ذو أصغر id لكل اسم
    db.run('DELETE FROM products WHERE id NOT IN (SELECT MIN(id) FROM products GROUP BY name)', [], function(err) {
        if (err) {
            console.error('خطأ في حذف المنتجات المتكررة:', err.message);
        } else {
            console.log(`تم حذف ${this.changes} منتج متكرر.`);
        }
        db.close();
    });
});
