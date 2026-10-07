const oracledb = require("oracledb");
require("dotenv").config();

// Configuración de formato de salida y transacciones
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 2,
  poolTimeout: 60,
  queueTimeout: 5000, // Si no obtiene conexión en 5 segundos, aborta con error
  enableStatistics: true,
};

let pool;

/**
 * Inicializa el pool de conexiones a Oracle Database
 */
async function initializeDbPool() {
  try {
    pool = await oracledb.createPool(dbConfig);
    console.log("✅ Pool de conexiones a Oracle Database inicializado con éxito");
  } catch (error) {
    console.error("❌ Error al inicializar el pool de conexiones de Oracle:", error.message);
    setTimeout(initializeDbPool, 5000);
  }
}

/**
 * Ejecuta una consulta SQL utilizando una conexión del pool
 */
async function executeQuery(sql, binds = {}, options = {}) {
  let connection;
  try {
    if (!pool) {
      throw new Error("ORA-POOL-NOT-INIT: El pool de conexiones no está listo.");
    }
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, options);

    if (options.autoCommit) {
      await connection.commit();
    }

    return result;
  } catch (error) {
    if (connection && !options.autoCommit) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Error al hacer rollback:", rollbackError.message);
      }
    }
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error("Error al liberar conexión al pool:", closeError.message);
      }
    }
  }
}

/**
 * Cierre controlado del pool al detener la aplicación
 */
async function closeDbPool() {
  if (pool) {
    try {
      await pool.close(10);
      console.log("Pool de conexiones de Oracle cerrado ordenadamente.");
    } catch (error) {
      console.error("Error al cerrar el pool de Oracle:", error.message);
    }
  }
}

module.exports = {
  initializeDbPool,
  executeQuery,
  closeDbPool,
};