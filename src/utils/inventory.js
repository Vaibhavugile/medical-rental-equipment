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

/**
 * createAssetsForProduct(productId, branchId, quantity = 1, assetMeta = {}, assetStatus = "in_stock")
 * Creates `quantity` asset documents in `assets` collection. Each asset gets:
 *  - assetId (human-friendly unique string)
 *  - productId
 *  - branchId (nullable)
 *  - status (in_stock | out_for_rental | maintenance | reserved)
 *  - metadata
 *  - createdAt, createdBy, createdByName
 *  - history: initial creation entry
 *
 * Returns: array of created asset descriptors: { id, assetId, ...payload }
 */
export async function createAssetsForProduct(productId, branchId = null, quantity = 1, assetMeta = {}, assetStatus = "in_stock") {
  if (!productId) throw new Error("productId required");
  const user = auth.currentUser || {};
  const created = [];
  for (let i = 0; i < Number(quantity || 0); i++) {
    const assetId = makeUniqueAssetId(productId);
    const payload = {
      assetId,
      productId,
      branchId: branchId || null,
      status: assetStatus,
      metadata: assetMeta || {},
      createdAt: serverTimestamp(),
      createdBy: user.uid || "",
      createdByName: user.displayName || user.email || "",
      history: [makeInventoryHistoryEntry(user, { type: "create", note: "Asset created" })],
    };
    const ref = await addDoc(collection(db, "assets"), payload);
    created.push({ id: ref.id, assetId, ...payload });
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
};
