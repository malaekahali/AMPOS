const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('خطأ في الاتصال بقاعدة البيانات:', err.message);
    } else {
        console.log('تم الاتصال بقاعدة البيانات بنجاح.');
    }
});

// قراءة ملف schema.sql وتنفيذه
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema, (err) => {
    if (err) {
        console.error('خطأ في إنشاء قاعدة البيانات:', err.message);
    } else {
        console.log('تم إنشاء قاعدة البيانات وإدراج البيانات التجريبية بنجاح.');
    }
    db.close();
});
