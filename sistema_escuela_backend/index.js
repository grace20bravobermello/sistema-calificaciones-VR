const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// 📁 Servir los archivos estáticos de la interfaz web (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '.')));

// 🛢️ Configuración dinámica de la base de datos (Render o Local)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Requerido para PostgreSQL en Render
      }
    : {
        user: 'postgres',
        host: 'localhost',
        database: 'utm_practicas_escuela',
        password: '123456', 
        port: 5432,
      }
);

// 🏠 Ruta raíz: Redirige automáticamente al Login cuando se ingrese a la URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// ==================== RUTAS DE LA API ====================

// Ruta para obtener la lista de estudiantes
app.get('/estudiantes', async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM estudiantes;');
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al conectar con la base de datos');
    }
});

// Ruta para obtener el historial completo de calificaciones
app.get('/historial-calificaciones', async (req, res) => {
    try {
        const consulta = `
            SELECT c.*, e.nombre, e.apellido 
            FROM calificaciones c
            JOIN estudiantes e ON c.id_estudiante = e.id_estudiante
            ORDER BY c.id_calificacion DESC;
        `;
        const resultado = await pool.query(consulta);
        res.json(resultado.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al obtener el historial desglosado');
    }
});

// Ruta para eliminar una calificación por su ID
app.delete('/calificaciones/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM calificaciones WHERE id_calificacion = $1;', [id]);
        res.json({ mensaje: "¡Calificación eliminada correctamente!" });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al eliminar la calificación');
    }
});

// Ruta para actualizar una calificación existente por su ID
app.put('/calificaciones/:id', async (req, res) => {
    const { id } = req.params;
    const {
        act1, act2, act3, act4, act5, act6,
        leccion, expo, taller, cuaderno,
        proyecto, examen
    } = req.body;

    try {
        const n1 = act1 !== "" && act1 !== null ? parseFloat(act1) : 0;
        const n2 = act2 !== "" && act2 !== null ? parseFloat(act2) : 0;
        const n3 = act3 !== "" && act3 !== null ? parseFloat(act3) : 0;
        const n4 = act4 !== "" && act4 !== null ? parseFloat(act4) : 0;
        const n5 = act5 !== "" && act5 !== null ? parseFloat(act5) : 0;
        const n6 = act6 !== "" && act6 !== null ? parseFloat(act6) : 0;

        const lec = leccion !== "" && leccion !== null ? parseFloat(leccion) : 0;
        const ex = expo !== "" && expo !== null ? parseFloat(expo) : 0;
        const tal = taller !== "" && taller !== null ? parseFloat(taller) : 0;
        const cua = cuaderno !== "" && cuaderno !== null ? parseFloat(cuaderno) : 0;

        const proy = proyecto !== "" && proyecto !== null ? parseFloat(proyecto) : 0;
        const exam = examen !== "" && examen !== null ? parseFloat(examen) : 0;

        const suma_tareas = n1 + n2 + n3 + n4 + n5 + n6;
        const promedio_tareas = suma_tareas / 6;
        const promedio_actuacion = (lec + ex + tal + cua) / 4;

        const total_aprovechamiento = promedio_tareas + lec + ex + tal + cua;
        const promedio_bloque_actividades = total_aprovechamiento / 5;
        const porcentaje_70 = promedio_bloque_actividades * 0.70;

        const promedio_bloque_examen_proy = (proy + exam) / 2;
        const porcentaje_30 = promedio_bloque_examen_proy * 0.30;

        const promedio_final = porcentaje_70 + porcentaje_30;

        const consultaSQL = `
            UPDATE calificaciones SET 
                actividad_1 = $1, actividad_2 = $2, actividad_3 = $3, 
                actividad_4 = $4, actividad_5 = $5, actividad_6 = $6, 
                leccion = $7, exposicion = $8, taller = $9, cuaderno = $10, 
                proyecto = $11, examen = $12,
                promedio_tareas = $13, promedio_actuacion = $14, 
                promedio_actividades_70 = $15, promedio_examen_proyecto_30 = $16, 
                promedio_final_trimestre = $17
            WHERE id_calificacion = $18
            RETURNING *;
        `;

        const resultado = await pool.query(consultaSQL, [
            n1, n2, n3, n4, n5, n6,
            lec, ex, tal, cua, proy, exam,
            promedio_tareas.toFixed(2), promedio_actuacion.toFixed(2), 
            porcentaje_70.toFixed(2), porcentaje_30.toFixed(2), promedio_final.toFixed(2),
            id
        ]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: "No se encontró la calificación para actualizar" });
        }

        res.json({
            mensaje: "✅ ¡Calificación actualizada con éxito!",
            datos: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al procesar la actualización de calificaciones');
    }
});

// Ruta para consultar si existe calificación previa de un estudiante
app.get('/calificaciones/:id_estudiante/:materia/:periodo/:anio_lectivo', async (req, res) => {
    const { id_estudiante, materia, periodo } = req.params;
    
    try {
        const resultado = await pool.query(
            `SELECT * FROM calificaciones WHERE id_estudiante = $1 AND materia = $2 AND periodo = $3;`,
            [id_estudiante, materia, periodo]
        );
        if (resultado.rows.length > 0) {
            res.json(resultado.rows[0]);
        } else {
            res.json(null);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al consultar notas existentes');
    }
});

// Ruta para registrar o actualizar calificaciones (Fórmula docente)
app.post('/calificaciones', async (req, res) => {
    const {
        id_estudiante, materia, periodo,
        act1, act2, act3, act4, act5, act6,
        leccion, expo, taller, cuaderno,
        proyecto, examen
    } = req.body;

    try {
        const notaExistente = await pool.query(
            `SELECT * FROM calificaciones WHERE id_estudiante = $1 AND materia = $2 AND periodo = $3;`,
            [id_estudiante, materia, periodo]
        );

        let previa = notaExistente.rows[0] || {};

        const n1 = act1 !== "" ? parseFloat(act1) : parseFloat(previa.actividad_1 || 0);
        const n2 = act2 !== "" ? parseFloat(act2) : parseFloat(previa.actividad_2 || 0);
        const n3 = act3 !== "" ? parseFloat(act3) : parseFloat(previa.actividad_3 || 0);
        const n4 = act4 !== "" ? parseFloat(act4) : parseFloat(previa.actividad_4 || 0);
        const n5 = act5 !== "" ? parseFloat(act5) : parseFloat(previa.actividad_5 || 0);
        const n6 = act6 !== "" ? parseFloat(act6) : parseFloat(previa.actividad_6 || 0);

        const lec = leccion !== "" ? parseFloat(leccion) : parseFloat(previa.leccion || 0);
        const ex = expo !== "" ? parseFloat(expo) : parseFloat(previa.exposicion || 0);
        const tal = taller !== "" ? parseFloat(taller) : parseFloat(previa.taller || 0);
        const cua = cuaderno !== "" ? parseFloat(cuaderno) : parseFloat(previa.cuaderno || 0);

        const proy = proyecto !== "" ? parseFloat(proyecto) : parseFloat(previa.proyecto || 0);
        const exam = examen !== "" ? parseFloat(examen) : parseFloat(previa.examen || 0);

        const suma_tareas = n1 + n2 + n3 + n4 + n5 + n6;
        const promedio_tareas = suma_tareas / 6;
        const promedio_actuacion = (lec + ex + tal + cua) / 4;

        const total_aprovechamiento = promedio_tareas + lec + ex + tal + cua;
        const promedio_bloque_actividades = total_aprovechamiento / 5;
        const porcentaje_70 = promedio_bloque_actividades * 0.70;

        const promedio_bloque_examen_proy = (proy + exam) / 2;
        const porcentaje_30 = promedio_bloque_examen_proy * 0.30;

        const promedio_final = porcentaje_70 + porcentaje_30;

        const consultaSQL = `
            INSERT INTO calificaciones (
                id_estudiante, materia, periodo, 
                actividad_1, actividad_2, actividad_3, actividad_4, actividad_5, actividad_6,
                leccion, exposicion, taller, cuaderno, proyecto, examen,
                promedio_tareas, promedio_actuacion, promedio_actividades_70, promedio_examen_proyecto_30, promedio_final_trimestre
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            ON CONFLICT (id_estudiante, materia, periodo) 
            DO UPDATE SET 
                actividad_1 = EXCLUDED.actividad_1,
                actividad_2 = EXCLUDED.actividad_2,
                actividad_3 = EXCLUDED.actividad_3,
                actividad_4 = EXCLUDED.actividad_4,
                actividad_5 = EXCLUDED.actividad_5,
                actividad_6 = EXCLUDED.actividad_6,
                leccion = EXCLUDED.leccion,
                exposicion = EXCLUDED.exposicion,
                taller = EXCLUDED.taller,
                cuaderno = EXCLUDED.cuaderno,
                proyecto = EXCLUDED.proyecto,
                examen = EXCLUDED.examen,
                promedio_tareas = EXCLUDED.promedio_tareas,
                promedio_actuacion = EXCLUDED.promedio_actuacion,
                promedio_actividades_70 = EXCLUDED.promedio_actividades_70,
                promedio_examen_proyecto_30 = EXCLUDED.promedio_examen_proyecto_30,
                promedio_final_trimestre = EXCLUDED.promedio_final_trimestre
            RETURNING *;
        `;

        const resultado = await pool.query(consultaSQL, [
            id_estudiante, materia, periodo,
            n1, n2, n3, n4, n5, n6,
            lec, ex, tal, cua, proy, exam,
            promedio_tareas.toFixed(2), promedio_actuacion.toFixed(2), porcentaje_70.toFixed(2), porcentaje_30.toFixed(2), promedio_final.toFixed(2)
        ]);

        res.json({
            mensaje: `¡Calificación de ${materia} registrada/actualizada con éxito!`,
            datos: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error al procesar el guardado de calificaciones');
    }
});

// Ruta para iniciar sesión del docente (Login)
app.post('/login', async (req, res) => {
    const { correo, contrasena } = req.body;
    try {
        const consulta = 'SELECT * FROM docente WHERE correo = $1;';
        const resultado = await pool.query(consulta, [correo]);

        if (resultado.rows.length === 0) {
            return res.status(401).json({ error: "El correo ingresado no está registrado." });
        }

        const docente = resultado.rows[0];

        if (docente.contrasena !== contrasena) {
            return res.status(401).json({ error: "Contraseña incorrecta." });
        }

        res.json({
            mensaje: "¡Inicio de sesión exitoso!",
            docente: {
                id_docente: docente.id_docente,
                nombre: docente.nombre,
                correo: docente.correo
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error en el servidor al procesar el inicio de sesión" });
    }
});

// Ruta para consultar asistencia por fecha
app.get('/asistencia/:fecha', async (req, res) => {
    const { fecha } = req.params;
    try {
        const consulta = `
            SELECT e.id_estudiante, e.nombre, e.apellido, a.estado
            FROM estudiantes e
            LEFT JOIN asistencia a ON e.id_estudiante = a.id_estudiante AND a.fecha = $1
            ORDER BY e.apellido ASC;
        `;
        const resultado = await pool.query(consulta, [fecha]);
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al obtener asistencia:", error);
        res.status(500).send("Error al obtener el listado de asistencia");
    }
});

// Ruta para guardar o actualizar asistencia
app.post('/asistencia', async (req, res) => {
    const { fecha, registros } = req.body;

    try {
        await pool.query('BEGIN');

        const consultaSQL = `
            INSERT INTO asistencia (id_estudiante, fecha, estado)
            VALUES ($1, $2, $3)
            ON CONFLICT (id_estudiante, fecha)
            DO UPDATE SET 
                estado = EXCLUDED.estado;
        `;

        for (const reg of registros) {
            await pool.query(consultaSQL, [
                reg.id_estudiante,
                fecha,
                reg.estado || 'Asistencia'
            ]);
        }

        await pool.query('COMMIT');
        res.json({ mensaje: "✅ ¡Asistencia guardada con éxito!" });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error al guardar asistencia:", error);
        res.status(500).send("Error al procesar el guardado de la asistencia");
    }
});

// Ruta para el resumen consolidado de asistencias
app.get('/asistencia-resumen', async (req, res) => {
    try {
        const consulta = `
            SELECT 
                e.id_estudiante, 
                e.nombre, 
                e.apellido,
                COUNT(CASE WHEN a.estado = 'Asistencia' THEN 1 END) AS asistencias,
                COUNT(CASE WHEN a.estado = 'Falta' THEN 1 END) AS faltas,
                COUNT(CASE WHEN a.estado = 'Justificado' THEN 1 END) AS justificados
            FROM estudiantes e
            LEFT JOIN asistencia a ON e.id_estudiante = a.id_estudiante
            GROUP BY e.id_estudiante, e.nombre, e.apellido
            ORDER BY e.apellido ASC;
        `;
        const resultado = await pool.query(consulta);
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al obtener resumen de asistencia:", error);
        res.status(500).send("Error al generar el reporte de asistencia");
    }
});

// Puerto asignado dinámicamente por Render o 3000 localmente
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});