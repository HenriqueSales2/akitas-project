// ===== Servidor Node.js + SQLite para Barbearia Akitas =====
// Os dados dos clientes ficam salvos no arquivo: agendamentos.db

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve arquivos estáticos (HTML, CSS, JS, vídeo, imagens)
app.use(express.static(path.join(__dirname)));

// ===== Banco de dados SQLite =====
// O arquivo agendamentos.db será criado automaticamente na primeira execução
const db = new Database(path.join(__dirname, "agendamentos.db"));

// Cria a tabela de agendamentos (executado uma vez)
db.exec(`
  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    servico TEXT NOT NULL,
    preco INTEGER NOT NULL,
    data TEXT NOT NULL,      -- formato YYYY-MM-DD
    horario TEXT NOT NULL,   -- formato HH:MM
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Índice para consulta rápida por data
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_agendamentos_data_horario 
  ON agendamentos(data, horario);
`);

// ===== Rotas =====

// 1) Listar agendamentos de uma data (para bloquear horários ocupados)
// GET /api/agendamentos?data=2026-11-10
app.get("/api/agendamentos", (req, res) => {
  const { data } = req.query;

  if (!data) {
    return res.status(400).json({ error: "Informe o parâmetro data (YYYY-MM-DD)" });
  }

  try {
    const rows = db
      .prepare("SELECT horario FROM agendamentos WHERE data = ?")
      .all(data);

    const ocupados = rows.map(r => r.horario);
    res.json({ data, ocupados, total: ocupados.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar agendamentos" });
  }
});

// 2) Criar um novo agendamento (reserva o horário)
// POST /api/agendamentos
// Body: { nome, telefone, servico, preco, data, horario }
app.post("/api/agendamentos", (req, res) => {
  const { nome, telefone, servico, preco, data, horario } = req.body;

  if (!nome || !telefone || !servico || !data || !horario) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  // Verifica se o horário já está ocupado para essa data
  const existente = db
    .prepare("SELECT id FROM agendamentos WHERE data = ? AND horario = ?")
    .get(data, horario);

  if (existente) {
    return res.status(409).json({ error: "Este horário já está ocupado. Escolha outro." });
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO agendamentos (nome, telefone, servico, preco, data, horario) 
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const info = stmt.run(nome, telefone, servico, preco, data, horario);

    res.status(201).json({
      success: true,
      id: info.lastInsertRowid,
      message: "Agendamento realizado com sucesso!"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar agendamento" });
  }
});

// 3) Listar todos os agendamentos (admin)
// GET /api/agendamentos/todos
app.get("/api/agendamentos/todos", (req, res) => {
  try {
    const rows = db
      .prepare("SELECT * FROM agendamentos ORDER BY data, horario")
      .all();
    res.json({ total: rows.length, agendamentos: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar agendamentos" });
  }
});

// 4) Deletar um agendamento (admin)
// DELETE /api/agendamentos/:id
app.delete("/api/agendamentos/:id", (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare("DELETE FROM agendamentos WHERE id = ?");
    const info = stmt.run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }
    res.json({ success: true, message: "Agendamento cancelado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao cancelar agendamento" });
  }
});

// ===== Inicia o servidor =====
app.listen(PORT, () => {
  console.log(`\n🪒 Servidor da Barbearia Akitas rodando em http://localhost:${PORT}`);
  console.log(`📁 Banco de dados: ${path.join(__dirname, "agendamentos.db")}`);
  console.log(`📋 Tabela: agendamentos (nome, telefone, servico, preco, data, horario, created_at)\n`);
});

module.exports = { app, db };
