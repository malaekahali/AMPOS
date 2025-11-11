const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.db');

// الحصول على المنتجات المكررة (نفس الاسم والتصنيف)
db.all(`
    SELECT name, category, COUNT(*) as count, GROUP_CONCAT(id) as ids
    FROM products
    GROUP BY name, category
    HAVING COUNT(*) > 1
`, [], (err, duplicates) => {
    if (err) {
        console.error('خطأ في البحث عن المنتجات المكررة:', err);
        return;
    }

    if (duplicates.length === 0) {
        console.log('لا توجد منتجات مكررة');
        db.close();
        return;
    }

    console.log('المنتجات المكررة الموجودة:');
    duplicates.forEach(duplicate => {
        console.log(`الاسم: ${duplicate.name}, التصنيف: ${duplicate.category}, العدد: ${duplicate.count}, المعرفات: ${duplicate.ids}`);
    });

    // حذف المنتجات المكررة، الاحتفاظ بالأول فقط
    let processed = 0;
    const total = duplicates.length;

    duplicates.forEach(duplicate => {
        const ids = duplicate.ids.split(',');
        const keepId = ids[0]; // الاحتفاظ بالأول
        const deleteIds = ids.slice(1); // حذف الباقي

        if (deleteIds.length > 0) {
            const placeholders = deleteIds.map(() => '?').join(',');
            db.run(`DELETE FROM products WHERE id IN (${placeholders})`, deleteIds, function(err) {
                if (err) {
                    console.error(`خطأ في حذف المنتجات المكررة لـ ${duplicate.name}:`, err);
                } else {
                    console.log(`تم حذف ${this.changes} منتج مكرر لـ ${duplicate.name}`);
                }

                processed++;
                if (processed === total) {
                    console.log('انتهى حذف المنتجات المكررة');
                    db.close();
                }
            });
        } else {
            processed++;
            if (processed === total) {
                console.log('انتهى حذف المنتجات المكررة');
                db.close();
            }
        }
    });
});
