const API_ITEMS = "/api/items";
const API_AUTH = "/api/auth";

const el = (id) => document.getElementById(id);

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

const authStatus = el("authStatus");
const roleStatus = el("roleStatus"); 
const loginForm = el("loginForm");
const logoutBtn = el("logoutBtn");
const authMsg = el("authMsg");

const brandInput = el("brand");
const skuInput = el("sku");
const editBrandInput = el("editBrand");
const editSkuInput = el("editSku");

let currentUser = null; 

function setMsg(node, text, kind = "") {
  if (!node) return;
  node.textContent = text || "";
  node.className = kind ? `msg ${kind}` : "msg";
}

const showMsg = (t, kind = "") => setMsg(msg, t, kind);
const showEditMsg = (t, kind = "") => setMsg(editMsg, t, kind);
const showAuthMsg = (t, kind = "") => setMsg(authMsg, t, kind);

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

function shortId(id) {
  const s = String(id || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function canModify(item) {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  return String(item.ownerId || "") === String(currentUser.id || "");
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const serverMsg = data?.error || data?.message || "";
    let errMsg = serverMsg || `Request failed (${res.status})`;

    if (res.status === 401) errMsg = serverMsg || "Unauthorized: please login first";
    if (res.status === 403) errMsg = serverMsg || "Forbidden: not enough permissions";

    const err = new Error(errMsg);
    err.status = res.status;
    err.data = data;
    throw err;
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

async function checkMe() {
  if (!authStatus) return false;

  try {
    const me = await apiFetch(`${API_AUTH}/me`);

    if (me.user) {
      currentUser = me.user;

      authStatus.textContent = `Logged in as: ${me.user.username}`;
      if (roleStatus) roleStatus.textContent = `Role: ${me.user.role || "user"}`;

      if (loginForm) loginForm.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";

      return true;
    }

    currentUser = null;
    authStatus.textContent = "Not logged in";
    if (roleStatus) roleStatus.textContent = "Role: -";

    if (loginForm) loginForm.style.display = "";
    if (logoutBtn) logoutBtn.style.display = "none";

    return false;
  } catch {
    currentUser = null;
    authStatus.textContent = "Not logged in";
    if (roleStatus) roleStatus.textContent = "Role: -";

    if (loginForm) loginForm.style.display = "";
    if (logoutBtn) logoutBtn.style.display = "none";

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

    showAuthMsg("Logged in!", "ok");
    await checkMe();
    await loadItems();
  } catch (err) {
    showAuthMsg(err.message, "err");
  }
});

logoutBtn?.addEventListener("click", async () => {
  showAuthMsg("");
  try {
    await apiFetch(`${API_AUTH}/logout`, { method: "POST" });
    showAuthMsg("Logged out", "ok");
    await checkMe();
    await loadItems();
  } catch (err) {
    showAuthMsg(err.message, "err");
  }
});

function renderRows(items) {
  const search = (searchInput?.value || "").trim().toLowerCase();

  const filtered = search
    ? items.filter((it) => String(it.name || "").toLowerCase().includes(search))
    : items;

  if (!filtered.length) {
    itemsTbody.innerHTML = `<tr><td colspan="8" class="muted">No products yet</td></tr>`;
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

      const ownerId = it.ownerId ? String(it.ownerId) : "";
      const ownerCell = ownerId ? escapeHtml(shortId(ownerId)) : "-";

      const allowed = canModify(it);
      const disabledAttr = allowed ? "" : "disabled";
      const titleAttr = allowed
        ? ""
        : `title="Forbidden: only owner or admin can modify"`;

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
          <td class="owner" title="${escapeHtml(ownerId)}">${ownerCell}</td>
          <td class="actions">
            <button class="smallBtn" data-action="edit" data-id="${id}" ${disabledAttr} ${titleAttr}>Edit</button>
            <button class="smallBtn danger" data-action="delete" data-id="${id}" ${disabledAttr} ${titleAttr}>Delete</button>
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
    showMsg(`Loaded: ${items.length}`, "ok");
  } catch (e) {
    showMsg(e.message, "err");
  }
}

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

    showMsg(`Created: ${created.name}`, "ok");
    await loadItems();
  } catch (err) {
    showMsg(err.message, "err");
  }
});

itemsTbody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  if (btn.disabled) {
    showMsg("Forbidden: only owner or admin can modify this item", "warn");
    return;
  }

  const action = btn.dataset.action;
  const id = String(btn.dataset.id);

  if (action === "delete") {
    const ok = confirm("Delete this product?");
    if (!ok) return;

    try {
      await apiFetch(`${API_ITEMS}/${id}`, { method: "DELETE" });
      showMsg("Deleted", "ok");
      await loadItems();
    } catch (err) {
      showMsg(err.message, "err");
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
      showMsg(err.message, "err");
    }
  }
});

closeModalBtn?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

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
    showMsg(`Updated: ${updated.name}`, "ok");
    await loadItems();
  } catch (err) {
    showEditMsg(err.message, "err");
  }
});

reloadBtn?.addEventListener("click", () => loadItems());
sortSelect?.addEventListener("change", () => loadItems());

searchInput?.addEventListener("input", async () => {
  clearTimeout(searchInput.__t);
  searchInput.__t = setTimeout(() => loadItems(), 250);
});

(async function init() {
  await checkMe();
  await loadItems();
})();
