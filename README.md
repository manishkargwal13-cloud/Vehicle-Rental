# Roam Vehicle Rental

A local vehicle-rental marketplace with a Node.js API and a SQLite SQL database.

## Run locally

1. Install Node.js 22.13 or newer.
2. From this folder, run:

   ```powershell
   node server.js
   ```

3. Open <http://127.0.0.1:3000>.

The app creates `data\roam.sqlite` and seeds the example fleet the first time it starts. The server binds to `127.0.0.1`; management routes require an administrator login. This is intended for local development. Add HTTPS and further deployment hardening before exposing it to other machines or the public internet.

The storefront and administrator page keep their browser-side behavior inline with their HTML, so each page contains its own markup and interactions. Shared presentation styles are in `styles.css`.

## Manage the marketplace

Select **Admin login** in the header to open the login page. On a fresh database, it prompts you to create the first administrator account. Once logged in, select **Manage fleet & site** to:

- Add, edit, hide, or delete cars, bikes, and scooters.
- Change vehicle price, location, details, image URL, listing badge, rating, and trip count.
- Edit website text including the brand name, hero, navigation, buttons, categories, steps, and footer.
- Review booking requests and update their status.

Vehicles, bookings, website settings, administrator password hashes, and sessions are stored in SQLite. On first run, open the **Admin login** page and create the first administrator account with a password of at least 12 characters. Passwords are hashed with scrypt; session tokens are random, stored as hashes in SQL, and issued in HttpOnly, SameSite cookies. The database structure is in `schema.sql`; the HTTP API is implemented in `server.js`.
