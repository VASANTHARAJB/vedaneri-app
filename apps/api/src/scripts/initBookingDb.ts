import dotenv from 'dotenv';
import path from 'path';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function initBookingTable() {
  console.log('⏳ Connecting directly to MariaDB...');

  let connection: mysql.Connection | null = null;

  try {
    // Separate connection calls so TypeScript resolves the correct overload
    if (process.env.DATABASE_URL) {
      connection = await mysql.createConnection(process.env.DATABASE_URL);
    } else {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'u846163676_omkara',
      });
    }

    console.log('🔍 Checking `devotees` table structure...');

    // 1. Detect exact data type of devotees.id to prevent errno 150
    const [devoteeCols]: any = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'devotees' 
        AND COLUMN_NAME = 'id'
    `);

    if (!devoteeCols || devoteeCols.length === 0) {
      throw new Error("`devotees` table not found in this database. Please ensure devotees table exists.");
    }

    const devoteeIdType = devoteeCols[0].COLUMN_TYPE;
    console.log(`ℹ️ Detected devotees.id data type: ${devoteeIdType}`);

    // 2. Create seva_bookings matching exact column type
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS seva_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        devotee_id ${devoteeIdType} NOT NULL,
        seva_id INT NOT NULL,
        seva_title VARCHAR(255) NOT NULL,
        category ENUM('seva', 'corpus') NOT NULL DEFAULT 'seva',
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        razorpay_order_id VARCHAR(100) UNIQUE,
        razorpay_payment_id VARCHAR(100),
        razorpay_signature VARCHAR(255),
        status ENUM('PENDING', 'SUCCESS', 'FAILED') DEFAULT 'PENDING',
        receipt_no VARCHAR(50),
        sankalpam_data LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_devotee (devotee_id),
        INDEX idx_status (status),
        INDEX idx_order (razorpay_order_id),
        CONSTRAINT fk_seva_bookings_devotee 
          FOREIGN KEY (devotee_id) REFERENCES devotees(id) 
          ON DELETE CASCADE 
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await connection.query(createTableQuery);
    console.log('✅ Table `seva_bookings` created / verified successfully in MariaDB!');

    const [desc]: any = await connection.query('DESCRIBE seva_bookings');
    console.log(`📋 Total verified columns: ${desc.length}`);
    console.log('\n✨ Database is now ready for Seva & Donation Razorpay orders!\n');
  } catch (error: any) {
    console.error('❌ Failed to create table:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

initBookingTable();