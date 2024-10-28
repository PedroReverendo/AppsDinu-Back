// ************ Require's ************
const express = require('express');
const path = require('path');
const logger = require('morgan');
const methodOverride = require('method-override');
const mysql = require('mysql');
const cors = require('cors');
const createError = require('http-errors');

// ************ express() ************
const app = express();

// ************ Middlewares ************
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(methodOverride('_method'));

// ************ Database Connection ************
const connection = mysql.createConnection({
  host: 'mysql-dinuapps.alwaysdata.net',
  user: 'dinuapps',
  password: 'DinuAppsNAtivas',
  database: 'dinuapps_nativas'
});

// Promisify connection.query to use async/await
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results) => {
      if (error) reject(error);
      resolve(results);
    });
  });
};

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database successfully!');
});

// ************ Error Handler Middleware ************
const errorHandler = (res, error, customMessage) => {
  console.error('Error:', error);
  return res.status(500).json({
    success: false,
    message: customMessage || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// ************ Routes and Queries ************

// Obtener todos los usuarios
app.get("/usuarios", async (req, res) => {
  try {
    const rows = await query('SELECT * FROM Usuarios');
    res.json(rows);
  } catch (error) {
    errorHandler(res, error, 'Error al obtener usuarios');
  }
});

// Login de usuario
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email y password son requeridos'
    });
  }

  try {
    const results = await query('SELECT * FROM Usuarios WHERE email = ? AND password = ?', [email, password]);
    if (results.length > 0) {
      const user = results[0];
      res.json({
        success: true,
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas'
      });
    }
  } catch (error) {
    errorHandler(res, error, 'Error en el proceso de login');
  }
});

// Crear un nuevo usuario
app.post("/usuarios", async (req, res) => {
  const { nombre, apellido, email, password, materia_id } = req.body;

  if (!nombre || !apellido || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Todos los campos son requeridos'
    });
  }

  try {
    // Verificar si el email ya existe
    const existingUser = await query('SELECT id FROM Usuarios WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    const result = await query(
      'INSERT INTO Usuarios (nombre, apellido, email, password, materia_id) VALUES (?, ?, ?, ?, ?)',
      [nombre, apellido, email, password, materia_id]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      userId: result.insertId
    });
  } catch (error) {
    errorHandler(res, error, 'Error al crear usuario');
  }
});

// Obtener todas las materias
app.get("/materias", async (req, res) => {
  try {
    const materias = await query('SELECT * FROM Materias');
    res.json(materias);
  } catch (error) {
    errorHandler(res, error, 'Error al obtener materias');
  }
});

// Crear una nueva materia
app.post("/materias", async (req, res) => {
  const { nombreMateria, descripcionMateria, profesor, fecha_inicio, fecha_fin } = req.body;

  if (!nombreMateria || !descripcionMateria || !profesor) {
    return res.status(400).json({
      success: false,
      message: 'Nombre, descripción y profesor son requeridos'
    });
  }

  try {
    const result = await query(
      'INSERT INTO Materias (nombreMateria, descripcionMateria, profesor, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?, ?)',
      [nombreMateria, descripcionMateria, profesor, fecha_inicio, fecha_fin]
    );

    res.status(201).json({
      success: true,
      message: 'Materia creada exitosamente',
      materiaId: result.insertId
    });
  } catch (error) {
    errorHandler(res, error, 'Error al crear materia');
  }
});

app.post("/inscribir", async (req, res) => {
  const { userId, materiaId } = req.body;
  
  console.log('Intento de inscripción:', { userId, materiaId }); // Log para debugging

  if (!userId || !materiaId) {
    console.log('Datos faltantes:', { userId, materiaId });
    return res.status(400).json({
      success: false,
      message: 'UserId y materiaId son requeridos'
    });
  }

  try {
    // Primero verificamos si la materia existe
    const materiaExiste = await query(
      'SELECT id FROM Materias WHERE id = ?',
      [materiaId]
    );

    if (materiaExiste.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'La materia no existe'
      });
    }

    // Verificamos si el usuario existe
    const usuarioExiste = await query(
      'SELECT id FROM Usuarios WHERE id = ?',
      [userId]
    );

    if (usuarioExiste.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'El usuario no existe'
      });
    }

    // Verificamos si ya está inscrito
    const inscripcionExistente = await query(
      'SELECT * FROM Inscripciones WHERE user_id = ? AND materia_id = ?',
      [userId, materiaId]
    );

    if (inscripcionExistente.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya está inscrito en esta materia'
      });
    }

    // Si todo está bien, procedemos con la inscripción
    await query(
      'INSERT INTO Inscripciones (user_id, materia_id) VALUES (?, ?)',
      [userId, materiaId]
    );

    console.log('Inscripción exitosa:', { userId, materiaId });
    
    res.json({
      success: true,
      message: 'Inscripción realizada exitosamente'
    });
  } catch (error) {
    console.error('Error detallado en inscripción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la inscripción',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
// Agregar estas rutas en tu archivo de backend

// Obtener datos de un usuario específico
app.get("/usuarios/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const rows = await query('SELECT id, nombre, apellido, email FROM Usuarios WHERE id = ?', [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    res.json(rows[0]);
  } catch (error) {
    errorHandler(res, error, 'Error al obtener datos del usuario');
  }
});

// Obtener materias inscritas de un usuario
app.get("/usuarios/:id/materias", async (req, res) => {
  try {
    const userId = req.params.id;
    const rows = await query(`
      SELECT m.* 
      FROM Materias m 
      INNER JOIN Inscripciones i ON m.id = i.materia_id 
      WHERE i.user_id = ?
    `, [userId]);
    
    res.json(rows);
  } catch (error) {
    errorHandler(res, error, 'Error al obtener materias del usuario');
  }
});

// Dar de baja de una materia
app.delete("/inscribir/:userId/:materiaId", async (req, res) => {
  try {
    const { userId, materiaId } = req.params;
    
    await query(
      'DELETE FROM Inscripciones WHERE user_id = ? AND materia_id = ?',
      [userId, materiaId]
    );
    
    res.json({
      success: true,
      message: 'Inscripción cancelada exitosamente'
    });
  } catch (error) {
    errorHandler(res, error, 'Error al cancelar la inscripción');
  }
});
// ************ Catch 404 and Forward to Error Handler ************
app.use((req, res, next) => next(createError(404)));

// ************ Error Handler ************
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    success: false,
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

module.exports = app;