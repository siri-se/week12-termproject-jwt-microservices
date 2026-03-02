const express = require('express');
const { pool } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/tasks — ดู tasks ทั้งหมด (ต้อง login)
router.get('/', requireAuth, async (req, res) => {
  try {
    // member เห็นแค่ tasks ของตัวเอง, admin เห็นทั้งหมด
    let query, params;
    if (req.user.role === 'admin') {
      query  = 'SELECT * FROM tasks ORDER BY created_at DESC';
      params = [];
    } else {
      query  = 'SELECT * FROM tasks WHERE owner_id = $1 OR assignee_id = $1 ORDER BY created_at DESC';
      params = [req.user.sub];
    }

    const result = await pool.query(query, params);
    res.json({ tasks: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('[TASK] GET / error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks — สร้าง task ใหม่ (ต้อง login)
router.post('/', requireAuth, async (req, res) => {
  const { title, description, priority, assignee_id } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title ห้ามว่าง' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, priority, owner_id, assignee_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title.trim(), description || '', priority || 'medium', req.user.sub, assignee_id || null]
    );
    console.log(`[TASK] Created by ${req.user.sub}: "${title}"`);
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id — อัพเดท task (ต้อง login + เป็นเจ้าของหรือ admin)
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, assignee_id } = req.body;

  try {
    // ตรวจสอบเจ้าของ task
    const checkResult = await pool.query(
      'SELECT * FROM tasks WHERE id = $1', [id]
    );
    if (!checkResult.rows[0]) {
      return res.status(404).json({ error: 'ไม่พบ Task' });
    }

    const task = checkResult.rows[0];
    // Authorization: admin ทำได้ทุก task, member ทำได้เฉพาะของตัวเอง
    if (req.user.role !== 'admin' && task.owner_id !== req.user.sub) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'คุณไม่มีสิทธิ์แก้ไข Task นี้'
      });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title       = COALESCE($1, title),
           description = COALESCE($2, description),
           status      = COALESCE($3, status),
           priority    = COALESCE($4, priority),
           assignee_id = COALESCE($5, assignee_id),
           updated_at  = NOW()
       WHERE id = $6
       RETURNING *`,
      [title, description, status, priority, assignee_id, id]
    );
    res.json({ task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id — ลบ task (admin หรือเจ้าของ)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const checkResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!checkResult.rows[0]) {
      return res.status(404).json({ error: 'ไม่พบ Task' });
    }

    if (req.user.role !== 'admin' && checkResult.rows[0].owner_id !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    console.log(`[TASK] Deleted task ${id} by ${req.user.sub}`);
    res.json({ message: 'ลบ Task สำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'task-service' });
});

module.exports = router;