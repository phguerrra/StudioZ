const express = require("express");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const dataDir = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "studioz.db");
const db = new sqlite3.Database(dbPath);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@studioz.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const adminTokens = new Set();

app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function createAdminToken() {
  return `adm_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function requireAdmin(req, res, next) {
  const token = String(req.headers["x-admin-token"] || "");
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ ok: false, message: "Acesso administrativo não autorizado." });
  }
  return next();
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      product_key TEXT NOT NULL,
      product_name TEXT NOT NULL,
      diameter REAL,
      height REAL,
      color TEXT,
      custom_text TEXT,
      font TEXT,
      position TEXT,
      image_data_url TEXT,
      price REAL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS product_prices (
      product_key TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      base_price REAL NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const existing = await all("SELECT product_key FROM product_prices");
  if (!existing || existing.length === 0) {
    const now = new Date().toISOString();
    await run(
      "INSERT INTO product_prices (product_key, product_name, base_price, updated_at) VALUES (?, ?, ?, ?)",
      ["caneca", "Caneca personalizada", 45, now]
    );
    await run(
      "INSERT INTO product_prices (product_key, product_name, base_price, updated_at) VALUES (?, ?, ?, ?)",
      ["copo_termico", "Copo térmico", 89, now]
    );
    await run(
      "INSERT INTO product_prices (product_key, product_name, base_price, updated_at) VALUES (?, ?, ?, ?)",
      ["garrafa", "Garrafa térmica", 120, now]
    );
    await run(
      "INSERT INTO product_prices (product_key, product_name, base_price, updated_at) VALUES (?, ?, ?, ?)",
      ["copo_pers", "Copo personalizado", 35, now]
    );
  }
}

app.get("/api/prices", async (_req, res) => {
  try {
    const rows = await all("SELECT product_key AS productKey, product_name AS productName, base_price AS basePrice FROM product_prices");
    return res.json({ ok: true, prices: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao carregar preços." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: "Preencha nome, e-mail e senha." });
    }

    const exists = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (exists) {
      return res.status(400).json({ ok: false, message: "Este e-mail já está cadastrado." });
    }

    await run(
      "INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)",
      [name, email, password, new Date().toISOString()]
    );
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao cadastrar usuário." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await get(
      "SELECT name, email FROM users WHERE email = ? AND password = ?",
      [email, password]
    );
    if (!user) {
      return res.status(401).json({ ok: false, message: "E-mail ou senha incorretos." });
    }
    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro no login." });
  }
});

app.post("/api/admin/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: "Credenciais de administrador inválidas." });
  }
  const token = createAdminToken();
  adminTokens.add(token);
  return res.json({
    ok: true,
    token,
    admin: { email: ADMIN_EMAIL, role: "Administrador" },
  });
});

app.post("/api/orders", async (req, res) => {
  try {
    const body = req.body || {};
    const requiredFields = ["userEmail", "userName", "productKey", "productName"];
    for (const field of requiredFields) {
      if (!body[field]) {
        return res.status(400).json({ ok: false, message: "Campos obrigatórios ausentes no pedido." });
      }
    }

    const createdAt = new Date().toISOString();
    const status = body.status || "Em análise";

    const result = await run(
      `INSERT INTO orders (
        user_email, user_name, product_key, product_name, diameter, height, color,
        custom_text, font, position, image_data_url, price, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.userEmail,
        body.userName,
        body.productKey,
        body.productName,
        body.diameter || null,
        body.height || null,
        body.color || "",
        body.text || "",
        body.font || "",
        body.position || "center",
        body.imageDataUrl || "",
        body.price || 0,
        status,
        createdAt,
      ]
    );

    return res.json({ ok: true, orderId: result.lastID });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao salvar pedido." });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, message: "Informe o e-mail." });

    const rows = await all(
      `SELECT id, user_email AS userEmail, user_name AS userName, product_key AS productKey,
              product_name AS productName, diameter, height, color, custom_text AS text,
              font, position, image_data_url AS imageDataUrl, price, status, created_at AS createdAt
       FROM orders
       WHERE user_email = ?
       ORDER BY datetime(created_at) DESC`,
      [email]
    );
    return res.json({ ok: true, orders: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao carregar pedidos." });
  }
});

app.patch("/api/orders/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body.status || "").trim();
    const validStatus = ["Em análise", "Em produção", "Pronto", "Entregue"];
    if (!id || !validStatus.includes(status)) {
      return res.status(400).json({ ok: false, message: "Dados inválidos para atualização." });
    }

    const result = await run("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
    if (!result.changes) {
      return res.status(404).json({ ok: false, message: "Pedido não encontrado." });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao atualizar pedido." });
  }
});

app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
  try {
    const totals = await get(
      `SELECT
        COUNT(*) AS totalOrders,
        COALESCE(SUM(price), 0) AS totalRevenue
      FROM orders`
    );
    const byStatusRows = await all(
      `SELECT status, COUNT(*) AS count
       FROM orders
       GROUP BY status`
    );
    const totalContacts = await get("SELECT COUNT(*) AS totalContacts FROM contacts");
    const totalUsers = await get("SELECT COUNT(*) AS totalUsers FROM users");

    const byStatus = {
      "Em análise": 0,
      "Em produção": 0,
      Pronto: 0,
      Entregue: 0,
    };
    byStatusRows.forEach((row) => {
      byStatus[row.status] = Number(row.count || 0);
    });

    return res.json({
      ok: true,
      stats: {
        totalOrders: Number(totals.totalOrders || 0),
        totalRevenue: Number(totals.totalRevenue || 0),
        totalContacts: Number(totalContacts.totalContacts || 0),
        totalUsers: Number(totalUsers.totalUsers || 0),
        byStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao buscar métricas do dashboard." });
  }
});

app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  try {
    const rows = await all(
      `SELECT id, user_email AS userEmail, user_name AS userName, product_key AS productKey,
              product_name AS productName, diameter, height, color, custom_text AS text,
              font, position, image_data_url AS imageDataUrl, price, status, created_at AS createdAt
       FROM orders
       ORDER BY datetime(created_at) DESC`
    );
    return res.json({ ok: true, orders: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao buscar pedidos do admin." });
  }
});

app.get("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    const row = await get(
      `SELECT id, user_email AS userEmail, user_name AS userName, product_key AS productKey,
              product_name AS productName, diameter, height, color, custom_text AS text,
              font, position, image_data_url AS imageDataUrl, price, status, created_at AS createdAt
       FROM orders
       WHERE id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ ok: false, message: "Pedido não encontrado." });
    return res.json({ ok: true, order: row });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao carregar detalhes do pedido." });
  }
});

app.patch("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });

    const status = req.body.status != null ? String(req.body.status).trim() : null;
    const priceRaw = req.body.price != null ? Number(req.body.price) : null;
    const validStatus = ["Em análise", "Em produção", "Pronto", "Entregue"];

    if (status !== null && !validStatus.includes(status)) {
      return res.status(400).json({ ok: false, message: "Status inválido." });
    }
    if (priceRaw !== null && (!Number.isFinite(priceRaw) || priceRaw < 0)) {
      return res.status(400).json({ ok: false, message: "Preço inválido." });
    }

    const fields = [];
    const params = [];
    if (status !== null) {
      fields.push("status = ?");
      params.push(status);
    }
    if (priceRaw !== null) {
      fields.push("price = ?");
      params.push(priceRaw);
    }
    if (fields.length === 0) {
      return res.status(400).json({ ok: false, message: "Nada para atualizar." });
    }
    params.push(id);

    const result = await run(`UPDATE orders SET ${fields.join(", ")} WHERE id = ?`, params);
    if (!result.changes) return res.status(404).json({ ok: false, message: "Pedido não encontrado." });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao atualizar pedido." });
  }
});

app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body.status || "").trim();
    const validStatus = ["Em análise", "Em produção", "Pronto", "Entregue"];
    if (!id || !validStatus.includes(status)) {
      return res.status(400).json({ ok: false, message: "Dados inválidos para atualização." });
    }
    const result = await run("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
    if (!result.changes) {
      return res.status(404).json({ ok: false, message: "Pedido não encontrado." });
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao atualizar pedido no admin." });
  }
});

app.get("/api/admin/prices", requireAdmin, async (_req, res) => {
  try {
    const rows = await all(
      "SELECT product_key AS productKey, product_name AS productName, base_price AS basePrice, updated_at AS updatedAt FROM product_prices ORDER BY product_name ASC"
    );
    return res.json({ ok: true, prices: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao carregar preços do admin." });
  }
});

app.put("/api/admin/prices/:productKey", requireAdmin, async (req, res) => {
  try {
    const productKey = String(req.params.productKey || "").trim();
    const basePrice = Number(req.body.basePrice);
    if (!productKey) return res.status(400).json({ ok: false, message: "Produto inválido." });
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return res.status(400).json({ ok: false, message: "Preço base inválido." });
    }
    const now = new Date().toISOString();
    const result = await run(
      "UPDATE product_prices SET base_price = ?, updated_at = ? WHERE product_key = ?",
      [basePrice, now, productKey]
    );
    if (!result.changes) return res.status(404).json({ ok: false, message: "Produto não encontrado." });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao atualizar preço." });
  }
});
app.get("/api/admin/contacts", requireAdmin, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 10)));
    const rows = await all(
      `SELECT id, nome, email, mensagem, created_at AS createdAt
       FROM contacts
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
      [limit]
    );
    return res.json({ ok: true, contacts: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao buscar contatos do admin." });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const mensagem = String(req.body.mensagem || "").trim();
    if (!nome || !email || !mensagem) {
      return res.status(400).json({ ok: false, message: "Preencha todos os campos do contato." });
    }
    await run("INSERT INTO contacts (nome, email, mensagem, created_at) VALUES (?, ?, ?, ?)", [
      nome,
      email,
      mensagem,
      new Date().toISOString(),
    ]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao salvar mensagem." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, HOST, () => {
      // eslint-disable-next-line no-console
      console.log(`Studio Z rodando em http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Falha ao iniciar banco de dados:", err);
    process.exit(1);
  });
