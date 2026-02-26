import express from "express";
import { createServer as createViteServer } from "vite";
import MDBReader from "mdb-reader";
import fs from "fs";
import path from "path";

const app = express();
const PORT = 3000;

// Function to get data from MDB
const getPhysicsData = () => {
  try {
    const possiblePaths = [
      path.join(process.cwd(), "fisica.mdb"),
      "/fisica.mdb",
      "./fisica.mdb"
    ];
    
    let mdbPath = "";
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        mdbPath = p;
        break;
      }
    }

    if (!mdbPath) {
      console.log("Archivo fisica.mdb no encontrado en ninguna de las rutas probadas.");
      return [];
    }

    console.log(`Leyendo MDB desde: ${mdbPath}`);
    const buffer = fs.readFileSync(mdbPath);
    if (buffer.length === 0) {
      console.log("El archivo fisica.mdb está vacío.");
      return [];
    }

    const reader = new MDBReader(buffer);
    const tableNames = reader.getTableNames();
    console.log("Tablas detectadas:", tableNames);
    
    let targetTable = "";
    let bestRows: any[] = [];

    // Buscamos la tabla con más filas que no sea de sistema
    for (const name of tableNames) {
      if (name.toLowerCase().startsWith('msys')) continue;
      
      try {
        const table = reader.getTable(name);
        const rows = table.getData();
        console.log(`Tabla ${name}: ${rows.length} filas`);
        if (rows.length > bestRows.length) {
          bestRows = rows;
          targetTable = name;
        }
      } catch (e) {
        console.error(`Error leyendo tabla ${name}:`, e);
      }
    }

    // Si no encontramos ninguna con datos, probamos la primera que no sea MSys
    if (bestRows.length === 0) {
      targetTable = tableNames.find(name => !name.toLowerCase().startsWith('msys')) || "";
      if (targetTable) {
        try {
          const table = reader.getTable(targetTable);
          bestRows = table.getData();
        } catch (e) {}
      }
    }

    if (bestRows.length === 0 && tableNames.length > 0 && !targetTable) {
        targetTable = tableNames[0];
        try {
            const table = reader.getTable(targetTable);
            bestRows = table.getData();
        } catch (e) {}
    }

    console.log(`Retornando ${bestRows.length} registros de la tabla ${targetTable}`);
    return bestRows.map((row: any, index: number) => ({
      _id: index + 1,
      ...row
    }));
  } catch (error) {
    console.error("Error crítico leyendo MDB:", error);
    return [];
  }
};

app.use(express.json());

// API Routes
app.get("/api/debug", (req, res) => {
  try {
    const possiblePaths = [
      path.join(process.cwd(), "fisica.mdb"),
      "/fisica.mdb",
      "./fisica.mdb"
    ];
    
    let mdbPath = "";
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        mdbPath = p;
        break;
      }
    }

    if (!mdbPath) {
      return res.json({ error: "Archivo no encontrado en ninguna ruta", pathsChecked: possiblePaths });
    }

    const buffer = fs.readFileSync(mdbPath);
    const reader = new MDBReader(buffer);
    const tableNames = reader.getTableNames();
    const tablesInfo = tableNames.map(name => {
      try {
        const table = reader.getTable(name);
        return { name, rows: table.getData().length };
      } catch (e: any) {
        return { name, error: e.message };
      }
    });
    res.json({ mdbPath, tableNames, tablesInfo });
  } catch (error: any) {
    res.json({ error: error.message });
  }
});

app.get("/api/records", (req, res) => {
  const q = req.query.q as string;
  const allData = getPhysicsData();
  
  if (q) {
    const search = q.toLowerCase();
    const filtered = allData.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(search)
      )
    );
    res.json(filtered);
  } else {
    res.json(allData);
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
