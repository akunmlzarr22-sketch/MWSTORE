import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { createServer as createViteServer } from "vite";

// Simple JSON Database
const DB_FILE = path.join(process.cwd(), "db.json");

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return {
        users: {},
        products: [],
        orders: [],
        topups: [],
        messages: [],
        vouchers: [],
        paymentSettings: {
          gateways: [
            { provider: 'Pak Kasir', merchantCode: '', apiKey: '', privateKey: '', baseUrl: '', isActive: false, mode: 'Production', slug: '' },
            { provider: 'Manual', merchantCode: '', apiKey: '', privateKey: '', baseUrl: '', isActive: true, mode: 'Production', slug: '' }
          ]
        },
        settings: { maintenanceMode: false }
      };
    }
    const content = fs.readFileSync(DB_FILE, "utf-8");
    if (!content || content.trim() === "") {
       throw new Error("Empty DB file");
    }
    return JSON.parse(content);
  } catch (e) {
    console.error("Error reading database, returning default:", e);
    return {
      users: {},
      products: [],
      orders: [],
      topups: [],
      messages: [],
      vouchers: [],
      paymentSettings: {
        gateways: [
          { provider: 'Pak Kasir', merchantCode: '', apiKey: '', privateKey: '', baseUrl: '', isActive: false, mode: 'Production', slug: '' },
          { provider: 'Manual', merchantCode: '', apiKey: '', privateKey: '', baseUrl: '', isActive: true, mode: 'Production', slug: '' }
        ]
      },
      settings: { maintenanceMode: false }
    };
  }
}

function writeDB(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/db", (req, res) => {
    try {
      console.log(`[${new Date().toISOString()}] GET /api/db received`);
      res.json(readDB());
    } catch (e) {
      console.error("GET /api/db failed:", e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/db", (req, res) => {
    try {
      console.log(`[${new Date().toISOString()}] POST /api/db received`);
      if (!req.body) {
        return res.status(400).json({ error: "Missing body" });
      }
      writeDB(req.body);
      res.json({ success: true });
    } catch (e) {
      console.error("POST /api/db failed:", e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Catch-all for API endpoints to prevent falling through to SPA HTML redirect
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint ${req.method} ${req.url} not found` });
  });

  // PAK KASIR WEBHOOK
  // This is the critical part for automation
  app.post("/api/webhook/pakkasir", (req, res) => {
    console.log("Pak Kasir Webhook Received:", req.body);
    
    const payload = req.body;
    const external_id = payload.external_id || payload.id || payload.reference;
    const status = (payload.status || "").toUpperCase();
    const amount = payload.amount || payload.total_amount;
    
    console.log("Pak Kasir Webhook Processing:", { external_id, status, amount });
    
    if (status === 'PAID' || status === 'COMPLETED' || status === 'SETTLED') {
      const db = readDB();
      // Search for topup with case-insensitive status matching
      const topup = db.topups.find((t: any) => 
        (String(t.id) === String(external_id) || String(t.reference) === String(external_id)) && 
        (t.status.toUpperCase() === 'PENDING' || t.status.toUpperCase() === 'PENDING_PAYMENT')
      );
      
      if (topup) {
        topup.status = 'COMPLETED';
        topup.updatedAt = new Date().toISOString();
        
        // Update user balance
        const user = db.users[topup.username];
        if (user) {
          user.balance = (user.balance || 0) + Number(amount);
          
          // Notify via message
          db.messages.unshift({
            id: 'MSG-' + Date.now(),
            sender: 'System',
            recipient: topup.username,
            content: `Top up sebesar Rp ${Number(amount).toLocaleString('id-ID')} berhasil via Pak Kasir! Saldo Anda sekarang: Rp ${user.balance.toLocaleString('id-ID')}`,
            timestamp: new Date().toISOString(),
            read: false
          });
        }
        
        writeDB(db);
        console.log(`Topup ${external_id} COMPLETED and balance updated for ${topup.username}`);
      } else {
        console.log(`Topup ${external_id} not found or already processed.`);
      }
    }
    
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
