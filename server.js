import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const dataDirectory = resolve(root, "data");
mkdirSync(dataDirectory, { recursive: true });
const db = new DatabaseSync(resolve(dataDirectory, "roam.sqlite"));
db.exec(readFileSync(resolve(root, "schema.sql"), "utf8"));
const scrypt = promisify(scryptCallback);
const sessionDurationMs = 12 * 60 * 60 * 1000;
const loginFailures = new Map();

const defaultVehicles = [
  ["Mini Cooper S", "2023 · Automatic · 4 seats", "Car", "Brooklyn, NY", 68, 4.96, 38, "GREAT FOR CITY", "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=85"],
  ["Vespa Primavera", "2024 · Automatic · 2 seats", "Scooter", "Manhattan, NY", 42, 4.92, 24, "EASY PICKUP", "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=85"],
  ["Jeep Wrangler", "2022 · Automatic · 5 seats", "Car", "Queens, NY", 94, 4.98, 51, "ROAD TRIP READY", "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=85"],
  ["Royal Enfield Classic", "2023 · Manual · 2 seats", "Bike", "Brooklyn, NY", 56, 4.89, 19, "HOST FAVORITE", "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=900&q=85"],
  ["Tesla Model 3", "2024 · Electric · 5 seats", "Car", "Jersey City, NJ", 105, 4.97, 42, "ELECTRIC", "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=900&q=85"],
  ["Honda PCX 160", "2023 · Automatic · 2 seats", "Scooter", "Manhattan, NY", 35, 4.88, 16, "GREAT VALUE", "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=85"],
];

const defaultSettings = {
  brandName: "roam",
  themePrimary: "#c9f26b",
  themeBackground: "#f8f8f5",
  themeHeroBackground: "#eef0e7",
  themeText: "#1d2825",
  themeDark: "#213e32",
  exploreNav: "Explore",
  howNav: "How it works",
  listVehicleButton: "List your vehicle",
  manageButton: "Manage fleet & site",
  bookingsButton: "My bookings",
  pickupLabel: "PICKUP LOCATION",
  pickupPlaceholder: "Where are you going?",
  pickupDateLabel: "PICKUP DATE",
  returnDateLabel: "RETURN DATE",
  searchButton: "Find a ride",
  heroEyebrow: "THE ROAD IS YOURS",
  heroTitle: "Find your way.",
  heroAccent: "Go somewhere.",
  heroDescription: "Good rides, great prices, and the freedom to take the scenic route.",
  browseEyebrow: "YOUR NEXT RIDE",
  browseTitle: "Pick your kind of trip",
  sortLabel: "Sort by",
  allRides: "All rides",
  cars: "Cars",
  bikes: "Bikes",
  scooters: "Scooters",
  clearFilters: "Clear filters",
  bookButton: "Book now",
  emptyTitle: "No rides found just yet",
  emptyDescription: "Try another location or switch up your filters.",
  showAllButton: "Show all rides",
  howEyebrow: "EASY AS ONE, TWO, GO",
  howTitle: "A better way to get there.",
  howDescription: "Skip the rental counter. Your next adventure is just a few taps away.",
  step1Title: "Find your ride",
  step1Description: "Browse unique rides from local hosts in your neighborhood.",
  step2Title: "Book in a few taps",
  step2Description: "Choose your dates, confirm your details, and you’re all set.",
  step3Title: "Make it a trip",
  step3Description: "Pick up your ride and take the long way if you feel like it.",
  footerDescription: "Good rides for wherever life takes you.",
  copyright: "© 2026 Roam Rentals",
};

if (!db.prepare("SELECT value FROM app_meta WHERE key = 'initial_seed'").get()) {
  const insert = db.prepare(`
    INSERT INTO vehicles (name, detail, type, location, price, rating, trips, tag, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  if (db.prepare("SELECT COUNT(*) AS count FROM vehicles").get().count === 0) {
    for (const vehicle of defaultVehicles) insert.run(...vehicle);
  }
  const saveSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  for (const [key, value] of Object.entries(defaultSettings)) saveSetting.run(key, value);
  db.prepare("INSERT INTO app_meta (key, value) VALUES ('initial_seed', 'done')").run();
}
const saveSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
for (const [key, value] of Object.entries(defaultSettings)) saveSetting.run(key, value);

const vehicleFields = {
  name: "string",
  detail: "string",
  type: "type",
  location: "string",
  price: "integer",
  rating: "rating",
  trips: "nonnegative",
  tag: "string",
  image: "url",
  active: "active",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validateVehicle(input, partial = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Send vehicle fields as a JSON object.");
  }
  const values = {};
  for (const [key, value] of Object.entries(input)) {
    const rule = vehicleFields[key];
    if (!rule) throw new HttpError(400, `Unknown vehicle field: ${key}.`);
    if (rule === "string") {
      if (typeof value !== "string" || !value.trim() || value.trim().length > (key === "detail" ? 160 : 100)) {
        throw new HttpError(400, `${key} must be a non-empty text value.`);
      }
      values[key] = value.trim();
    } else if (rule === "type") {
      if (!["Car", "Bike", "Scooter"].includes(value)) throw new HttpError(400, "Type must be Car, Bike, or Scooter.");
      values[key] = value;
    } else if (rule === "integer") {
      if (!Number.isSafeInteger(value) || value < 1 || value > 10000) throw new HttpError(400, "Price must be a whole number between 1 and 10,000.");
      values[key] = value;
    } else if (rule === "rating") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 5) throw new HttpError(400, "Rating must be between 0 and 5.");
      values[key] = value;
    } else if (rule === "nonnegative") {
      if (!Number.isSafeInteger(value) || value < 0) throw new HttpError(400, "Trips must be a non-negative whole number.");
      values[key] = value;
    } else if (rule === "url") {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new HttpError(400, "Image must be a valid HTTP or HTTPS URL.");
      }
      if (!["http:", "https:"].includes(url.protocol)) throw new HttpError(400, "Image must be a valid HTTP or HTTPS URL.");
      values[key] = url.href;
    } else if (rule === "active") {
      if (typeof value !== "boolean") throw new HttpError(400, "Active must be true or false.");
      values[key] = value ? 1 : 0;
    }
  }
  if (!partial) {
    for (const required of ["name", "detail", "type", "location", "price", "image"]) {
      if (!(required in values)) throw new HttpError(400, `Missing required vehicle field: ${required}.`);
    }
  }
  if (Object.keys(values).length === 0) throw new HttpError(400, "Include at least one vehicle field to update.");
  return values;
}

function readVehicle(id) {
  return db.prepare(`
    SELECT id, name, detail, type, location, price, rating, trips, tag, image,
      active = 1 AS active, created_at AS createdAt
    FROM vehicles WHERE id = ?
  `).get(id);
}

function readJson(request) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new HttpError(413, "Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolveBody(body ? JSON.parse(body) : {});
      } catch {
        reject(new HttpError(400, "Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex || !/^[\da-f]{128}$/i.test(expectedHex)) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requestSession(request) {
  const cookieHeader = request.headers.cookie || "";
  const token = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("roam_session="))?.slice("roam_session=".length);
  if (!token || !/^[\da-f]{64}$/.test(token)) return null;
  const tokenHash = hashToken(token);
  const session = db.prepare(`
    SELECT admins.id, admins.email, admin_sessions.expires_at AS expiresAt
    FROM admin_sessions JOIN admins ON admins.id = admin_sessions.admin_id
    WHERE admin_sessions.token_hash = ?
  `).get(tokenHash);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  return { ...session, tokenHash };
}

function requireAdmin(request) {
  const session = requestSession(request);
  if (!session) throw new HttpError(401, "Log in as an administrator to continue.");
  return session;
}

function setSessionCookie(response, token, maxAge) {
  const secure = response.req.socket.encrypted ? "; Secure" : "";
  response.setHeader("Set-Cookie", `roam_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

async function handleApi(request, response, url) {
  const { pathname } = url;
  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  if (pathname === "/api/auth/status" && request.method === "GET") {
    const adminCount = db.prepare("SELECT COUNT(*) AS count FROM admins").get().count;
    const session = requestSession(request);
    sendJson(response, 200, {
      setupRequired: adminCount === 0,
      authenticated: Boolean(session),
      email: session?.email ?? null,
    });
    return true;
  }

  if (pathname === "/api/auth/setup" && request.method === "POST") {
    const input = await readJson(request);
    if (typeof input.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254) {
      throw new HttpError(400, "Enter a valid administrator email address.");
    }
    if (typeof input.password !== "string" || input.password.length < 12 || input.password.length > 200) {
      throw new HttpError(400, "Choose a password between 12 and 200 characters.");
    }
    const passwordHash = await hashPassword(input.password);
    db.exec("BEGIN IMMEDIATE");
    let adminId;
    try {
      if (db.prepare("SELECT COUNT(*) AS count FROM admins").get().count !== 0) {
        throw new HttpError(409, "Administrator setup is already complete. Please log in.");
      }
      const result = db.prepare("INSERT INTO admins (email, password_hash) VALUES (?, ?)").run(input.email.trim(), passwordHash);
      adminId = Number(result.lastInsertRowid);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)")
      .run(hashToken(token), adminId, Date.now() + sessionDurationMs);
    setSessionCookie(response, token, sessionDurationMs / 1000);
    sendJson(response, 201, { authenticated: true, email: input.email.trim() });
    return true;
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    const address = request.socket.remoteAddress || "unknown";
    const failure = loginFailures.get(address);
    if (failure && failure.retryAfter > Date.now()) {
      throw new HttpError(429, "Too many login attempts. Wait 15 minutes and try again.");
    }
    const input = await readJson(request);
    if (typeof input.email !== "string" || input.email.length > 254
      || typeof input.password !== "string" || input.password.length > 200) {
      throw new HttpError(400, "Enter your administrator email and password.");
    }
    const admin = db.prepare("SELECT id, email, password_hash AS passwordHash FROM admins WHERE email = ? COLLATE NOCASE")
      .get(input.email.trim());
    const valid = admin ? await verifyPassword(input.password, admin.passwordHash) : false;
    if (!valid) {
      const attempts = (failure?.attempts ?? 0) + 1;
      loginFailures.set(address, attempts >= 5
        ? { attempts, retryAfter: Date.now() + 15 * 60 * 1000 }
        : { attempts, retryAfter: 0 });
      throw new HttpError(401, "Email or password is incorrect.");
    }
    loginFailures.delete(address);
    db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(Date.now());
    const token = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)")
      .run(hashToken(token), admin.id, Date.now() + sessionDurationMs);
    setSessionCookie(response, token, sessionDurationMs / 1000);
    sendJson(response, 200, { authenticated: true, email: admin.email });
    return true;
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const session = requestSession(request);
    if (session) db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(session.tokenHash);
    setSessionCookie(response, "", 0);
    sendJson(response, 200, { authenticated: false });
    return true;
  }

  if (
    (pathname === "/api/vehicles" && request.method === "POST")
    || (/^\/api\/vehicles\/\d+$/.test(pathname) && ["PATCH", "DELETE"].includes(request.method))
    || (pathname === "/api/vehicles" && url.searchParams.get("all") === "1")
    || (pathname === "/api/settings" && request.method === "PATCH")
    || (pathname === "/api/bookings" && request.method === "GET")
    || (/^\/api\/bookings\/\d+$/.test(pathname) && request.method === "PATCH")
  ) {
    requireAdmin(request);
  }

  if (pathname === "/api/vehicles" && request.method === "GET") {
    const showInactive = url.searchParams.get("all") === "1";
    const where = showInactive ? "" : "WHERE active = 1";
    const vehicles = db.prepare(`
      SELECT id, name, detail, type, location, price, rating, trips, tag, image,
        active = 1 AS active, created_at AS createdAt
      FROM vehicles ${where} ORDER BY id DESC
    `).all();
    sendJson(response, 200, vehicles);
    return true;
  }

  if (pathname === "/api/vehicles" && request.method === "POST") {
    const vehicle = validateVehicle(await readJson(request));
    const result = db.prepare(`
      INSERT INTO vehicles (name, detail, type, location, price, rating, trips, tag, image, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      vehicle.name, vehicle.detail, vehicle.type, vehicle.location,
      vehicle.price, vehicle.rating ?? 5, vehicle.trips ?? 0,
      vehicle.tag ?? "NEW LISTING", vehicle.image, vehicle.active ?? 1,
    );
    sendJson(response, 201, readVehicle(Number(result.lastInsertRowid)));
    return true;
  }

  const vehicleMatch = pathname.match(/^\/api\/vehicles\/(\d+)$/);
  if (vehicleMatch) {
    const id = Number(vehicleMatch[1]);
    if (request.method === "PATCH") {
      const existing = readVehicle(id);
      if (!existing) throw new HttpError(404, "Vehicle not found.");
      const updates = validateVehicle(await readJson(request), true);
      const fields = Object.keys(updates);
      db.prepare(`UPDATE vehicles SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ?`)
        .run(...fields.map((field) => updates[field]), id);
      sendJson(response, 200, readVehicle(id));
      return true;
    }
    if (request.method === "DELETE") {
      const result = db.prepare("DELETE FROM vehicles WHERE id = ?").run(id);
      if (result.changes === 0) throw new HttpError(404, "Vehicle not found.");
      sendJson(response, 200, { deleted: true });
      return true;
    }
  }

  if (pathname === "/api/settings" && request.method === "GET") {
    const settings = Object.fromEntries(db.prepare("SELECT key, value FROM settings").all().map(({ key, value }) => [key, value]));
    sendJson(response, 200, settings);
    return true;
  }

  if (pathname === "/api/settings" && request.method === "PATCH") {
    const updates = await readJson(request);
    if (!updates || typeof updates !== "object" || Array.isArray(updates) || Object.keys(updates).length === 0) {
      throw new HttpError(400, "Send at least one site setting to update.");
    }
    for (const [key, value] of Object.entries(updates)) {
      if (!(key in defaultSettings)) throw new HttpError(400, `Unknown site setting: ${key}.`);
      if (typeof value !== "string" || !value.trim() || value.length > 240) throw new HttpError(400, `${key} must be non-empty text under 240 characters.`);
      if (key.startsWith("theme") && !/^#[\da-fA-F]{6}$/.test(value)) throw new HttpError(400, `${key} must be a six-digit hex color.`);
    }
    const save = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    db.exec("BEGIN");
    try {
      for (const [key, value] of Object.entries(updates)) save.run(key, value.trim());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    const settings = Object.fromEntries(db.prepare("SELECT key, value FROM settings").all().map(({ key, value }) => [key, value]));
    sendJson(response, 200, settings);
    return true;
  }

  if (pathname === "/api/bookings" && request.method === "GET") {
    const bookings = db.prepare(`
      SELECT id, vehicle_id AS vehicleId, vehicle_name AS vehicle,
        pickup_date AS pickup, return_date AS dropoff, customer_name AS name,
        customer_email AS email, total, status, created_at AS createdAt
      FROM bookings ORDER BY id DESC
    `).all();
    sendJson(response, 200, bookings);
    return true;
  }

  if (pathname === "/api/bookings" && request.method === "POST") {
    const input = await readJson(request);
    const vehicleId = Number(input.vehicleId);
    const vehicle = Number.isSafeInteger(vehicleId) && vehicleId > 0
      ? db.prepare("SELECT id, name, price FROM vehicles WHERE id = ? AND active = 1").get(vehicleId)
      : null;
    if (!vehicle) throw new HttpError(404, "This vehicle is no longer available.");
    const pickup = typeof input.pickup === "string" ? input.pickup : "";
    const dropoff = typeof input.dropoff === "string" ? input.dropoff : "";
    const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
      && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
    if (!validDate(pickup) || !validDate(dropoff) || dropoff <= pickup) throw new HttpError(400, "Choose valid rental dates with return after pickup.");
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80) throw new HttpError(400, "Enter your name (up to 80 characters).");
    if (typeof input.email !== "string" || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new HttpError(400, "Enter a valid email address.");
    const conflict = db.prepare(`
      SELECT id FROM bookings
      WHERE vehicle_id = ? AND status != 'CANCELLED'
        AND pickup_date < ? AND return_date > ?
      LIMIT 1
    `).get(vehicleId, dropoff, pickup);
    if (conflict) throw new HttpError(409, "This vehicle is already requested for part of those dates.");
    const days = (Date.parse(`${dropoff}T12:00:00Z`) - Date.parse(`${pickup}T12:00:00Z`)) / 86_400_000;
    const result = db.prepare(`
      INSERT INTO bookings (vehicle_id, vehicle_name, pickup_date, return_date, customer_name, customer_email, total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(vehicle.id, vehicle.name, pickup, dropoff, input.name.trim(), input.email.trim(), days * vehicle.price);
    const booking = db.prepare(`
      SELECT id, vehicle_id AS vehicleId, vehicle_name AS vehicle,
        pickup_date AS pickup, return_date AS dropoff, customer_name AS name,
        customer_email AS email, total, status, created_at AS createdAt
      FROM bookings WHERE id = ?
    `).get(Number(result.lastInsertRowid));
    sendJson(response, 201, booking);
    return true;
  }

  const bookingMatch = pathname.match(/^\/api\/bookings\/(\d+)$/);
  if (bookingMatch && request.method === "PATCH") {
    const { status } = await readJson(request);
    if (!["REQUESTED", "CONFIRMED", "CANCELLED", "COMPLETED"].includes(status)) {
      throw new HttpError(400, "Status must be REQUESTED, CONFIRMED, CANCELLED, or COMPLETED.");
    }
    const result = db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, Number(bookingMatch[1]));
    if (result.changes === 0) throw new HttpError(404, "Booking not found.");
    sendJson(response, 200, { id: Number(bookingMatch[1]), status });
    return true;
  }

  if (pathname.startsWith("/api/")) throw new HttpError(404, "API route not found.");
  return false;
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function serveStatic(request, response, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    throw new HttpError(400, "Invalid URL path.");
  }
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/login") {
    response.writeHead(302, { Location: "/login.html" });
    response.end();
    return;
  }
  if (!["/index.html", "/login.html", "/styles.css"].includes(pathname)) throw new HttpError(404, "File not found.");
  const filePath = resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) throw new HttpError(403, "Forbidden.");
  if (!existsSync(filePath)) throw new HttpError(404, "File not found.");
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (request.headers.origin) {
      let origin;
      try {
        origin = new URL(request.headers.origin);
      } catch {
        throw new HttpError(403, "Invalid request origin.");
      }
      if (origin.host !== request.headers.host) throw new HttpError(403, "Cross-origin requests are not allowed.");
    }
    if (await handleApi(request, response, url)) return;
    await serveStatic(request, response, url);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error("Request failed:", error);
    sendJson(response, status, { error: status === 500 ? "An unexpected server error occurred." : error.message });
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "127.0.0.1", () => {
  console.log(`Roam is running at http://127.0.0.1:${port}`);
  console.log(`SQLite database: ${resolve(dataDirectory, "roam.sqlite")}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
