// src/utils/inventory.js
// Shared inventory helpers: products, assets (individual items), and simple inventory operations.
// Drop into src/utils/inventory.js

import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase";

/**
 * Simple unique id generator for assetId suffixes.
 * Format: <productId>-<ts36>-<rand6>
 */
function makeUniqueAssetId(productId) {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${productId}-${ts}-${rnd}`;
}

/**
 * makeInventoryHistoryEntry(user, opts)
 * user optional — will fallback to auth.currentUser
 * opts: { type, note, data }
 */
export function makeInventoryHistoryEntry(user = {}, opts = {}) {
  const u = user && (user.uid || user.displayName || user.email) ? user : (auth.currentUser || {});
  return {
    ts: new Date().toISOString(),
    by: u.uid || "system",
    byName: u.displayName || u.email || u.uid || "system",
    type: opts.type || "update",
    note: opts.note || null,
    data: opts.data || null,
  };
}

/**
 * createProduct({ name, sku, description, defaultRate, category, metadata })
 * returns: created product doc ref id + payload (note: addDoc returns ref; this returns { id, ...payload } after creation)
 */
export async function createProduct({ name, sku, description = "", defaultRate = 0, category = "general", metadata = {} } = {}) {
  if (!name) throw new Error("Product name required");
  const user = auth.currentUser || {};
  const payload = {
    name,
    sku: sku || `SKU-${Date.now()}`,
    description,
    defaultRate: Number(defaultRate || 0),
    category,
    metadata,
    createdAt: serverTimestamp(),
    createdBy: user.uid || "",
    createdByName: user.displayName || user.email || "",
  };
  const ref = await addDoc(collection(db, "products"), payload);
  return { id: ref.id, ...payload };
}

const makeCompanyCode = (company) => {
  return String(company || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") // remove spaces & symbols
    .slice(0, 5) || "COMP";
};
export async function deleteAsset(assetDocId) {
  if (!assetDocId) throw new Error("assetDocId required");
  await deleteDoc(doc(db, "assets", assetDocId));
}


export async function createAssetsForProduct(
  productId,
  branchId = null,
  quantity = 1,
  company = null, // ✅ optional
  assetStatus = "in_stock",
  options = {}
) {
  if (!productId) throw new Error("productId required");

  const user = auth.currentUser || {};
  const created = [];

  const companyPrefix = (options.companyPrefix || "BMM").toUpperCase();
  const batch =
    options.batch != null
      ? String(options.batch)
      : String(new Date().getFullYear()).slice(-2);

  const shortCode = (options.shortCode || "PRD").toUpperCase();

  // ✅ SAFE company handling
  const cleanCompany =
    typeof company === "string" && company.trim()
      ? company.trim()
      : null;

  // ✅ If no company → use neutral code
  const companyCode = cleanCompany
    ? makeCompanyCode(cleanCompany)
    : "GEN"; // ← generic assets

  const prefix = `${companyPrefix}${companyCode}${shortCode}${batch}`;

  // Fetch existing assets for this product
  const q = query(collection(db, "assets"), where("productId", "==", productId));
  const snap = await getDocs(q);

  let maxSeq = 0;
  snap.docs.forEach((d) => {
    const aid = d.data()?.assetId || "";
    if (!aid.startsWith(prefix)) return;

    const m = aid.match(/(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
    }
  });

  const lastSeqIfAllCreated = maxSeq + Number(quantity || 0);
  const padLen = Math.max(3, String(lastSeqIfAllCreated).length);
  const pad = (num) => String(num).padStart(padLen, "0");

  for (let i = 1; i <= Number(quantity || 0); i++) {
    let candidateSeq = maxSeq + i;
    let candidateId = `${prefix}${pad(candidateSeq)}`;

    // ensure uniqueness
    while (true) {
      const qExist = query(
        collection(db, "assets"),
        where("assetId", "==", candidateId)
      );
      const exSnap = await getDocs(qExist);
      if (exSnap.empty) break;

      candidateSeq += 1;
      candidateId = `${prefix}${pad(candidateSeq)}`;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      candidateId
    )}`;

    const payload = {
      assetId: candidateId,
      productId,
      company: cleanCompany, // ✅ null when not used
      branchId: branchId || null,
      status: assetStatus,
      qrUrl,
      createdAt: serverTimestamp(),
      createdBy: user.uid || "",
      createdByName: user.displayName || user.email || "",
      history: [
        makeInventoryHistoryEntry(user, {
          type: "create",
          note: cleanCompany
            ? `Asset created for company ${cleanCompany}`
            : "Asset created (no company)",
        }),
      ],
    };

    const ref = await addDoc(collection(db, "assets"), payload);
    created.push({ id: ref.id, assetId: candidateId, ...payload });
  }

  return created;
}




/**
 * changeAssetStatus(assetDocId, newStatus, note = "", extra = {})
 * Updates status and appends history entry.
 */
export async function changeAssetStatus(assetDocId, newStatus, note = "", extra = {}) {
  if (!assetDocId) throw new Error("assetDocId required");
  const user = auth.currentUser || {};
  const assetRef = doc(db, "assets", assetDocId);
  const entry = makeInventoryHistoryEntry(user, { type: "status", note, data: { newStatus, ...extra } });
  await updateDoc(assetRef, {
    status: newStatus,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });
}

// --- replace your reserveAsset with this version (logs + before/after) ---
export async function reserveAsset(
  assetDocId,
  { reservationId = null, orderId = null, customer = null, until = null, note = "Reserved for order" } = {}
) {
  if (!assetDocId) throw new Error("assetDocId required");
  console.log("🔵 reserveAsset() called", { assetDocId, orderId, customer, until });

  const user = auth.currentUser || {};
  const assetRef = doc(db, "assets", assetDocId);

  // log current state
  const beforeSnap = await getDoc(assetRef);
  if (!beforeSnap.exists()) {
    console.error("❌ reserveAsset: asset not found:", assetDocId);
    return;
  }
  console.log("📦 Before reserve — status:", beforeSnap.data()?.status, "reservation:", beforeSnap.data()?.reservation);

  const entry = makeInventoryHistoryEntry(user, {
    type: "reserve",
    note,
    data: { reservationId, orderId, customer, until },
  });

  await updateDoc(assetRef, {
    status: "reserved",
    reservation: { reservationId, orderId, customer, until },
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });

  // log after state (optional but useful)
  const afterSnap = await getDoc(assetRef);
  console.log("✅ After reserve — status:", afterSnap.data()?.status, "reservation:", afterSnap.data()?.reservation);

  return { ok: true, id: assetDocId, status: afterSnap.data()?.status };
}


/**
+ * Clear reservation and return asset to stock.
+ */
// --- replace your unreserveAsset with this version (logs + before/after) ---
export async function unreserveAsset(assetDocId, { note = "Reservation cleared" } = {}) {
  if (!assetDocId) throw new Error("assetDocId required");
  console.log("🟠 unreserveAsset() called", { assetDocId });

  const user = auth.currentUser || {};
  const assetRef = doc(db, "assets", assetDocId);

  const beforeSnap = await getDoc(assetRef);
  if (!beforeSnap.exists()) {
    console.error("❌ unreserveAsset: asset not found:", assetDocId);
    return;
  }
  console.log("📦 Before unreserve — status:", beforeSnap.data()?.status, "reservation:", beforeSnap.data()?.reservation);

  const entry = makeInventoryHistoryEntry(user, { type: "reserve_clear", note });

  await updateDoc(assetRef, {
    status: "in_stock",
    reservation: null,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });

  const afterSnap = await getDoc(assetRef);
  console.log("✅ After unreserve — status:", afterSnap.data()?.status, "reservation:", afterSnap.data()?.reservation);

  return { ok: true, id: assetDocId, status: afterSnap.data()?.status };
}

/**
 * checkoutAsset(assetDocId, { rentalId = null, customer = null, until = null, note })
 * Marks asset out_for_rental and records rental metadata and history entry.
 */
export async function checkoutAsset(assetDocId, { rentalId = null, customer = null, until = null, note = "Checked out for rental" } = {}) {
  if (!assetDocId) throw new Error("assetDocId required");
  const user = auth.currentUser || {};
  const assetRef = doc(db, "assets", assetDocId);
  const entry = makeInventoryHistoryEntry(user, { type: "checkout", note, data: { rentalId, customer, until } });
  await updateDoc(assetRef, {
    status: "out_for_rental",
    rental: { rentalId: rentalId || null, customer: customer || null, until: until || null },
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });
}

/**
 * checkinAsset(assetDocId, { note = "Checked in", condition = "ok" })
 * Marks asset in_stock, clears rental metadata, appends history.
 */
export async function checkinAsset(assetDocId, { note = "Checked in", condition = "ok" } = {}) {
  if (!assetDocId) throw new Error("assetDocId required");
  const user = auth.currentUser || {};
  const assetRef = doc(db, "assets", assetDocId);
  const entry = makeInventoryHistoryEntry(user, { type: "checkin", note, data: { condition } });
  await updateDoc(assetRef, {
    status: "in_stock",
    rental: null,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });
}

/**
 * moveAssetToBranch(assetDocId, toBranchId, note = "Moved to another branch")
 * Updates branchId and appends history.
 */
export async function moveAssetToBranch(assetDocId, toBranchId, note = "Moved to another branch") {
  if (!assetDocId) throw new Error("assetDocId required");
  const user = auth.currentUser || {};
  const assetRef = doc(db, "assets", assetDocId);
  const entry = makeInventoryHistoryEntry(user, { type: "move", note, data: { toBranchId } });
  await updateDoc(assetRef, {
    branchId: toBranchId || null,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });
}

/**
 * LIST helpers (return arrays of docs with id + data)
 */
export async function listBranches() {
  const q = query(collection(db, "branches"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

export async function listProducts() {
  const q = query(collection(db, "products"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/**
 * listAssets({ productId = null, branchId = null, status = null } = {})
 * If no filters provided returns all assets (ordered by createdAt desc).
 * If filters provided, builds where clauses.
 */
export async function listAssets({ productId = null, branchId = null, status = null } = {}) {
  const clauses = [];
  if (productId) clauses.push(where("productId", "==", productId));
  if (branchId) clauses.push(where("branchId", "==", branchId));
  if (status) clauses.push(where("status", "==", status));

  let snap;
  if (clauses.length) {
    const q = query(collection(db, "assets"), ...clauses, orderBy("createdAt", "desc"));
    snap = await getDocs(q);
  } else {
    const q = query(collection(db, "assets"), orderBy("createdAt", "desc"));
    snap = await getDocs(q);
  }
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

export default {
  makeInventoryHistoryEntry,
  createProduct,
  createAssetsForProduct,
  changeAssetStatus,
  checkoutAsset,
  checkinAsset,
  moveAssetToBranch,
  listBranches,
  listProducts,
  listAssets,
  reserveAsset,
  unreserveAsset,
};
