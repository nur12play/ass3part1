// public/app.js
const API_ITEMS = "/api/items";
const API_AUTH = "/api/auth";

const el = (id) => document.getElementById(id);

// ---------- Elements ----------
const addForm = el("addForm");
const itemsTbody = el("items");
const msg = el("msg");

const searchInput = el("search");
const sortSelect = el("sort");
const reloadBtn = el("reload");

const modal = el("modal");
const closeModalBtn = el("closeModal");
const editForm = el("editForm");
const editMsg = el("editMsg");

// Auth UI
const authStatus = el("authStatus");
const loginForm = el("loginForm");
const logoutBtn = el("logoutBtn");
const authMsg = el("authMsg");

// NEW fields in forms (must exist in index.html)
const brandInput = el("brand");
const skuInput = el("sku");
const editBrandInput = el("editBrand");
const editSkuInput = el("editSku");

// ---------- UI helpers ----------
function setText(node, text, isError = false) {
  if (!node) return;
  node.textContent = text || "";
  node.style.color = isError ? "#ff8a8a" : "#aab3c5";
}

const showMsg = (t, e = false) => setText(msg, t, e);
const showEditMsg = (t, e = false) => setText(editMsg, t, e);
const showAuthMsg = (t, e = false) => setText(authMsg, t, e);

function openModal() {
  modal?.classList.remove("hidden");
}
function closeModal() {
  modal?.classList.add("hidden");
  showEditMsg("");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toFixed(2);
}

// ---------- API helper ----------
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errMsg = data?.error || `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data;
}

function buildItemsQuery() {
  const q = new URLSearchParams();
  const sort = sortSelect?.value;
  if (sort) q.set("sort", sort);

  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

// ---------- Auth ----------
async function checkMe() {
  if (!authStatus) return false;

  try {
    const me = await apiFetch(`${API_AUTH}/me`);
    if (me.user) {
      authStatus.textContent = `Logged in as: ${me.user.username}`;
      return true;
    }
    authStatus.textContent = "Not logged in";
    return false;
  } catch {
    authStatus.textContent = "Not logged in";
    return false;
  }
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showAuthMsg("");

  const username = el("loginUser")?.value?.trim();
  const password = el("loginPass")?.value;

  try {
    await apiFetch(`${API_AUTH}/login`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    showAuthMsg("Logged in!");
    await checkMe();
    loadItems().catch(() => {});
  } catch (err) {
    showAuthMsg(err.message, true);
  }
});

logoutBtn?.addEventListener("click", async () => {
  showAuthMsg("");
  try {
    await apiFetch(`${API_AUTH}/logout`, { method: "POST" });
    showAuthMsg("Logged out");
    await checkMe();
  } catch (err) {
    showAuthMsg(err.message, true);
  }
});

// ---------- Render items ----------
function renderRows(items) {
  const search = (searchInput?.value || "").trim().toLowerCase();

  const filtered = search
    ? items.filter((it) => String(it.name || "").toLowerCase().includes(search))
    : items;

  // IMPORTANT: table now has 7 columns (Name, Price, Category, Brand, SKU, InStock, Actions)
  if (!filtered.length) {
    itemsTbody.innerHTML = `<tr><td colspan="7" class="muted">No products yet</td></tr>`;
    return;
  }

  itemsTbody.innerHTML = filtered
    .map((it) => {
      const id = String(it._id);
      const name = escapeHtml(it.name);
      const category = escapeHtml(it.category || "general");
      const brand = escapeHtml(it.brand || "");
      const sku = escapeHtml(it.sku || "");
      const price = money(it.price);
      const inStock = !!it.inStock;

      return `
        <tr>
          <td>${name}</td>
          <td class="num">${price}</td>
          <td>${category}</td>
          <td>${brand}</td>
          <td>${sku}</td>
          <td>
            <span class="badge ${inStock ? "ok" : "no"}">
              ${inStock ? "Yes" : "No"}
            </span>
          </td>
          <td class="actions">
            <button class="smallBtn" data-action="edit" data-id="${id}">Edit</button>
            <button class="smallBtn danger" data-action="delete" data-id="${id}">Delete</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadItems() {
  showMsg("Loading...");
  try {
    const items = await apiFetch(`${API_ITEMS}${buildItemsQuery()}`);
    renderRows(items);
    showMsg(`Loaded: ${items.length}`);
  } catch (e) {
    showMsg(e.message, true);
  }
}

// ---------- Add ----------
addForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg("");

  const name = el("name")?.value?.trim();
  const price = Number(el("price")?.value);
  const category = el("category")?.value?.trim();
  const brand = brandInput?.value?.trim() || "";
  const sku = skuInput?.value?.trim() || "";
  const inStock = !!el("inStock")?.checked;

  try {
    const created = await apiFetch(API_ITEMS, {
      method: "POST",
      body: JSON.stringify({
        name,
        price,
        category: category || "general",
        brand,
        sku,
        inStock,
      }),
    });

    addForm.reset();
    const chk = el("inStock");
    if (chk) chk.checked = true;

    showMsg(`Created: ${created.name}`);
    loadItems().catch(() => {});
  } catch (err) {
    showMsg(err.message, true);
  }
});

// ---------- Table actions (Edit/Delete) ----------
itemsTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = String(btn.dataset.id);

  if (action === "delete") {
    const ok = confirm("Delete this product?");
    if (!ok) return;

    try {
      await apiFetch(`${API_ITEMS}/${id}`, { method: "DELETE" });
      showMsg("Deleted");
      loadItems().catch(() => {});
    } catch (err) {
      showMsg(err.message, true);
    }
    return;
  }

  if (action === "edit") {
    try {
      const item = await apiFetch(`${API_ITEMS}/${id}`);

      el("editId").value = String(item._id);
      el("editName").value = item.name ?? "";
      el("editPrice").value = item.price ?? 0;
      el("editCategory").value = item.category ?? "general";
      if (editBrandInput) editBrandInput.value = item.brand ?? "";
      if (editSkuInput) editSkuInput.value = item.sku ?? "";
      el("editInStock").checked = !!item.inStock;

      showEditMsg("");
      openModal();
    } catch (err) {
      showMsg(err.message, true);
    }
  }
});

// ---------- Modal events ----------
closeModalBtn?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// ---------- Save (Update) ----------
editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showEditMsg("");

  const id = String(el("editId")?.value || "");
  const name = el("editName")?.value?.trim();
  const price = Number(el("editPrice")?.value);
  const category = el("editCategory")?.value?.trim();
  const brand = editBrandInput?.value?.trim() || "";
  const sku = editSkuInput?.value?.trim() || "";
  const inStock = !!el("editInStock")?.checked;

  try {
    const updated = await apiFetch(`${API_ITEMS}/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, price, category, brand, sku, inStock }),
    });

    closeModal();
    showMsg(`Updated: ${updated.name}`);
    loadItems().catch(() => {});
  } catch (err) {
    showEditMsg(err.message, true);
  }
});

// ---------- Filters ----------
reloadBtn?.addEventListener("click", () => loadItems());
sortSelect?.addEventListener("change", () => loadItems());
searchInput?.addEventListener("input", () => loadItems());

// ---------- Init ----------
loadItems();
checkMe();
