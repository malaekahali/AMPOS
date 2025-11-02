const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('database.db');

const hash = bcrypt.hashSync('1234512', 10);

db.run('UPDATE employees SET password = ? WHERE employee_number = ?', [hash, '1234'], (err) => {
  if (err) console.error(err);
  else console.log('Updated admin password');
});

db.run('UPDATE employees SET password = ? WHERE employee_number = ?', [hash, '5678'], (err) => {
  if (err) console.error(err);
  else console.log('Updated cashier password');
  db.close();
});
