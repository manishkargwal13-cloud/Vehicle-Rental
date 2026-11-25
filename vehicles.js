// vehiclesdata.js (Guaranteed Live Fix)
const vehiclesData = [
  // CARS
  {
    id: 1,
    name: "Hyundai Creta SX",
    type: "Cars",
    price: 2200,
    rating: 4.8,
    location: "Jaipur",
    fuel: "Petrol",
    seats: 5,
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 2,
    name: "Maruti Swift VXI",
    type: "Cars",
    price: 1400,
    rating: 4.6,
    location: "Delhi",
    fuel: "Petrol",
    seats: 5,
    image: "https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 3,
    name: "Mahindra Thar 4x4",
    type: "Cars",
    price: 3500,
    rating: 4.9,
    location: "Manali",
    fuel: "Diesel",
    seats: 4,
    image: "https://images.unsplash.com/photo-1633505899118-4ca6bd143043?auto=format&fit=crop&w=600&q=80"
  },

  // BIKES
  {
    id: 4,
    name: "Royal Enfield Classic 350",
    type: "Bikes",
    price: 900,
    rating: 4.9,
    location: "Jaipur",
    fuel: "Petrol",
    seats: 2,
    image: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 5,
    name: "Yamaha MT-15",
    type: "Bikes",
    price: 750,
    rating: 4.7,
    location: "Bengaluru",
    fuel: "Petrol",
    seats: 2,
    image: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=600&q=80"
  },

  // SCOOTERS
  {
    id: 6,
    name: "Honda Activa 6G",
    type: "Scooters",
    price: 450,
    rating: 4.7,
    location: "Goa",
    fuel: "Petrol",
    seats: 2,
    image: "https://images.unsplash.com/photo-1519750783826-e2420f4d687f?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 7,
    name: "TVS Jupiter 125",
    type: "Scooters",
    price: 400,
    rating: 4.5,
    location: "Pune",
    fuel: "Petrol",
    seats: 2,
    image: "https://images.unsplash.com/photo-1622185135505-2d795003994a?auto=format&fit=crop&w=600&q=80"
  }
];

let currentCategory = "All rides";

function getCardHTML(v) {
  return `
    <div style="border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: left;">
      <img src="${v.image}" alt="${v.name}" style="width: 100%; height: 180px; object-fit: cover; display: block;">
      <div style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 12px; font-weight: 600; background: #ecfccb; color: #365314; padding: 3px 8px; border-radius: 6px;">${v.type}</span>
          <span style="font-size: 13px; font-weight: 600;">★ ${v.rating}</span>
        </div>
        <h3 style="margin: 6px 0; font-size: 18px; color: #111827;">${v.name}</h3>
        <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">${v.location} • ${v.fuel} • ${v.seats} Seats</p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f3f4f6; padding-top: 12px;">
          <div>
            <strong style="font-size: 18px; color: #111827;">₹${v.price}</strong>
            <span style="font-size: 12px; color: #6b7280;"> / day</span>
          </div>
          <button onclick="alert('Booking selected: ${v.name} (₹${v.price}/day)')" style="background: #84cc16; color: #111; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Book now
          </button>
        </div>
      </div>
    </div>
  `;
}

function syncVehiclesUI() {
  const filtered =
    currentCategory === "All rides"
      ? vehiclesData
      : vehiclesData.filter(
          (v) => v.type.toLowerCase() === currentCategory.toLowerCase()
        );

  // Count text ("0 rides to explore") अपडेट करना
  const countEl = Array.from(document.querySelectorAll("p, span, div")).find((el) =>
    /^\d+\s+rides to explore$/i.test(el.textContent.trim())
  );
  if (countEl && countEl.textContent.trim() !== `${filtered.length} rides to explore`) {
    countEl.textContent = `${filtered.length} rides to explore`;
  }

  // Empty state ("No rides found just yet" / "Backend connection required") को कार्ड्स से बदलना
  let grid = document.getElementById("roam-vehicles-grid");
  if (!grid) {
    const targetEl = Array.from(document.querySelectorAll("h2, p, div, span")).find(
      (el) =>
        el.textContent.trim() === "No rides found just yet" ||
        el.textContent.trim() === "Backend connection required"
    );

    if (targetEl) {
      const box =
        targetEl.textContent.trim() === "No rides found just yet" && targetEl.parentElement
          ? targetEl.parentElement
          : targetEl;

      grid = document.createElement("div");
      grid.id = "roam-vehicles-grid";
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
        gap: 20px;
        margin-top: 20px;
        width: 100%;
      `;
      box.replaceWith(grid);
    }
  }

  if (grid) {
    grid.innerHTML = filtered.map(getCardHTML).join("");
  }

  // Category buttons पर क्लिक लिसनर लगाना
  const categories = ["All rides", "Cars", "Bikes", "Scooters"];
  const buttons = Array.from(document.querySelectorAll("button")).filter((btn) =>
    categories.includes(btn.textContent.trim())
  );

  buttons.forEach((btn) => {
    if (!btn.dataset.roamBound) {
      btn.dataset.roamBound = "1";
      btn.addEventListener("click", () => {
        currentCategory = btn.textContent.trim();
        setTimeout(syncVehiclesUI, 50);
      });
    }
  });
}

setInterval(syncVehiclesUI, 500);
window.addEventListener("load", () => setTimeout(syncVehiclesUI, 200));
