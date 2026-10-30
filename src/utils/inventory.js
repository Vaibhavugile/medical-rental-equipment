// src/utils/inventory.js

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

// -------------------- HELPERS --------------------

function makeUniqueAssetId(productId) {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${productId}-${ts}-${rnd}`;
}

function datesOverlap(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && aEnd >= bStart;
}

export function makeInventoryHistoryEntry(user = {}, opts = {}) {
  const u =
    user && (user.uid || user.displayName || user.email)
      ? user
      : auth.currentUser || {};

  return {
    ts: new Date().toISOString(),
    by: u.uid || "system",
    byName: u.displayName || u.email || u.uid || "system",
    type: opts.type || "update",
    note: opts.note || null,
    data: opts.data || null,
  };
}

// -------------------- PRODUCTS --------------------

export async function createProduct({
  name,
  sku,
  description = "",
  defaultRate = 0,
  category = "general",
  metadata = {},
} = {}) {
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
  return (
    String(company || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5) || "COMP"
  );
};

// -------------------- DELETE ASSET --------------------

export async function deleteAsset(assetDocId) {
  if (!assetDocId) throw new Error("assetDocId required");

  await deleteDoc(doc(db, "assets", assetDocId));
}

// -------------------- CREATE INVENTORY / ASSETS --------------------

export async function createAssetsForProduct(
  productId,
  branchId = null,
  quantity = 1,
  company = null,
  assetStatus = "in_stock",
  options = {}
) {
  if (!productId) {
    throw new Error("productId required");
  }

  const qty = Number(quantity);

  if (!Number.isInteger(qty) || qty < 1) {
    throw new Error("Quantity must be a whole number greater than zero");
  }

  const user = auth.currentUser || {};
  const created = [];

  // Purchase information
  const purchasePricePerUnit = Number(
    options.purchasePricePerUnit ?? 0
  );

  if (
    !Number.isFinite(purchasePricePerUnit) ||
    purchasePricePerUnit < 0
  ) {
    throw new Error("A valid purchase price per unit is required");
  }

  const purchaseDate =
    options.purchaseDate || new Date().toISOString().slice(0, 10);

  const supplier = String(options.supplier || "").trim();

  const purchaseTotal = purchasePricePerUnit * qty;

  // Create purchase batch
  const purchaseBatchRef = await addDoc(
    collection(db, "inventoryPurchaseBatches"),
    {
      productId,
      quantity: qty,
      purchasePricePerUnit,
      totalPurchaseCost: purchaseTotal,
      purchaseDate,
      supplier,
      branchId: branchId || null,
      company:
        typeof company === "string" && company.trim()
          ? company.trim()
          : null,
      createdAt: serverTimestamp(),
      createdBy: user.uid || "",
      createdByName: user.displayName || user.email || "",
      status: "created",
    }
  );

  // Asset ID configuration
  const companyPrefix = (
    options.companyPrefix || "BMM"
  ).toUpperCase();

  const batch =
    options.batch != null
      ? String(options.batch)
      : String(new Date().getFullYear()).slice(-2);

  const shortCode = (
    options.shortCode || "PRD"
  ).toUpperCase();

  const cleanCompany =
    typeof company === "string" && company.trim()
      ? company.trim()
      : null;

  const companyCode = cleanCompany
    ? makeCompanyCode(cleanCompany)
    : "GEN";

  const prefix = `${companyPrefix}${companyCode}${shortCode}${batch}`;

  // Fetch existing assets for this product
  const existingQuery = query(
    collection(db, "assets"),
    where("productId", "==", productId)
  );

  const snap = await getDocs(existingQuery);

  let maxSeq = 0;

  snap.docs.forEach((d) => {
    const aid = d.data()?.assetId || "";

    // FIXED REGEX: safely escape special characters in prefix
    const escapedPrefix = prefix.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const match = aid.match(
      new RegExp(`^${escapedPrefix}(\\d{3})$`)
    );

    if (!match) return;

    const n = Number(match[1]);

    if (!Number.isNaN(n) && n > maxSeq) {
      maxSeq = n;
    }
  });

  const lastSeqIfAllCreated = maxSeq + qty;

  const padLen = Math.max(
    3,
    String(lastSeqIfAllCreated).length
  );

  const pad = (num) =>
    String(num).padStart(padLen, "0");

  // Create individual assets
  for (let i = 1; i <= qty; i++) {
    let candidateSeq = maxSeq + i;

    let candidateId = `${prefix}${pad(candidateSeq)}`;

    // Ensure unique asset ID
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

    const qrUrl =
      `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        candidateId
      )}`;

    const payload = {
      assetId: candidateId,
      productId,
      company: cleanCompany,
      branchId: branchId || null,
      status: assetStatus,
      qrUrl,

      // Purchase information on each asset
      purchasePrice: purchasePricePerUnit,
      purchasePricePerUnit,
      purchaseBatchId: purchaseBatchRef.id,
      purchaseDate,
      purchaseSupplier: supplier,

      createdAt: serverTimestamp(),
      createdBy: user.uid || "",
      createdByName: user.displayName || user.email || "",

      history: [
        makeInventoryHistoryEntry(user, {
          type: "purchase",
          note: `Asset added at purchase cost ${purchasePricePerUnit}`,
          data: {
            purchasePricePerUnit,
            purchaseBatchId: purchaseBatchRef.id,
            purchaseDate,
            supplier,
          },
        }),
      ],
    };

    const ref = await addDoc(
      collection(db, "assets"),
      payload
    );

    created.push({
      id: ref.id,
      assetId: candidateId,
      ...payload,
    });
  }

  // Update purchase batch after assets are created
  await updateDoc(
    doc(db, "inventoryPurchaseBatches", purchaseBatchRef.id),
    {
      assetIds: created.map((asset) => asset.id),
      createdAssetCount: created.length,
      status: created.length === qty ? "completed" : "partial",
      completedAt: serverTimestamp(),
    }
  );

  return created;
}

// -------------------- CHANGE ASSET STATUS --------------------

export async function changeAssetStatus(
  assetDocId,
  newStatus,
  note = "",
  extra = {}
) {
  if (!assetDocId) {
    throw new Error("assetDocId required");
  }

  const user = auth.currentUser || {};

  const assetRef = doc(db, "assets", assetDocId);

  const entry = makeInventoryHistoryEntry(user, {
    type: "status",
    note,
    data: { newStatus, ...extra },
  });

  await updateDoc(assetRef, {
    status: newStatus,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });
}

// -------------------- RESERVE ASSET --------------------

export async function reserveAsset(
  assetDocId,
  {
    reservationId = null,
    orderId = null,
    customer = null,
    from = null,
    to = null,
    note = "Reserved for order",
  } = {}
) {
  if (!assetDocId) {
    throw new Error("assetDocId required");
  }

  console.log("🔵 reserveAsset() called", {
    assetDocId,
    orderId,
    customer,
    from,
    to,
  });

  const user = auth.currentUser || {};

  const assetRef = doc(db, "assets", assetDocId);

  const beforeSnap = await getDoc(assetRef);

  if (!beforeSnap.exists()) {
    console.error(
      "❌ reserveAsset: asset not found:",
      assetDocId
    );
    return;
  }

  console.log(
    "📦 Before reserve — status:",
    beforeSnap.data()?.status,
    "reservation:",
    beforeSnap.data()?.reservation
  );

  const entry = makeInventoryHistoryEntry(user, {
    type: "reserve",
    note,
    data: {
      reservationId,
      orderId,
      customer,
      from,
      to,
    },
  });

  await updateDoc(assetRef, {
    status: "reserved",
    reservation: {
      reservationId,
      orderId,
      customer,
      from,
      to,
    },
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });

  const afterSnap = await getDoc(assetRef);

  console.log(
    "✅ After reserve — status:",
    afterSnap.data()?.status,
    "reservation:",
    afterSnap.data()?.reservation
  );

  return {
    ok: true,
    id: assetDocId,
    status: afterSnap.data()?.status,
  };
}

// -------------------- UNRESERVE ASSET --------------------

export async function unreserveAsset(
  assetDocId,
  { note = "Reservation cleared" } = {}
) {
  if (!assetDocId) {
    throw new Error("assetDocId required");
  }

  console.log("🟠 unreserveAsset() called", { assetDocId });

  const user = auth.currentUser || {};

  const assetRef = doc(db, "assets", assetDocId);

  const beforeSnap = await getDoc(assetRef);

  if (!beforeSnap.exists()) {
    console.error(
      "❌ unreserveAsset: asset not found:",
      assetDocId
    );
    return;
  }

  console.log(
    "📦 Before unreserve — status:",
    beforeSnap.data()?.status,
    "reservation:",
    beforeSnap.data()?.reservation
  );

  const entry = makeInventoryHistoryEntry(user, {
    type: "reserve_clear",
    note,
  });

  await updateDoc(assetRef, {
    status: "in_stock",
    reservation: null,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });

  const afterSnap = await getDoc(assetRef);

  console.log(
    "✅ After unreserve — status:",
    afterSnap.data()?.status,
    "reservation:",
    afterSnap.data()?.reservation
  );

  return {
    ok: true,
    id: assetDocId,
    status: afterSnap.data()?.status,
  };
}

// -------------------- CHECKOUT ASSET --------------------

export async function checkoutAsset(
  assetDocId,
  {
    rentalId = null,
    customer = null,
    until = null,
    note = "Checked out for rental",
  } = {}
) {
  if (!assetDocId) {
    throw new Error("assetDocId required");
  }

  const user = auth.currentUser || {};

  const assetRef = doc(db, "assets", assetDocId);

  const entry = makeInventoryHistoryEntry(user, {
    type: "checkout",
    note,
    data: { rentalId, customer, until },
  });

  await updateDoc(assetRef, {
    status: "out_for_rental",
    rental: {
      rentalId: rentalId || null,
      customer: customer || null,
      until: until || null,
    },
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });
}

// -------------------- CHECKIN ASSET --------------------

export async function checkinAsset(
  assetDocId,
  {
    note = "Checked in",
    condition = "ok",
  } = {}
) {
  if (!assetDocId) {
    throw new Error("assetDocId required");
  }

  const user = auth.currentUser || {};

  const assetRef = doc(db, "assets", assetDocId);

  const entry = makeInventoryHistoryEntry(user, {
    type: "checkin",
    note,
    data: { condition },
  });

  await updateDoc(assetRef, {
    status: "in_stock",
    rental: null,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });
}

// -------------------- MOVE ASSET TO BRANCH --------------------

export async function moveAssetToBranch(
  assetDocId,
  toBranchId,
  note = "Moved to another branch"
) {
  if (!assetDocId) {
    throw new Error("assetDocId required");
  }

  const user = auth.currentUser || {};

  const assetRef = doc(db, "assets", assetDocId);

  const entry = makeInventoryHistoryEntry(user, {
    type: "move",
    note,
    data: { toBranchId },
  });

  await updateDoc(assetRef, {
    branchId: toBranchId || null,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid || "",
    updatedByName: user.displayName || user.email || "",
    history: arrayUnion(entry),
  });
}

// -------------------- LIST BRANCHES --------------------

export async function listBranches() {
  const q = query(
    collection(db, "branches"),
    orderBy("name", "asc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() || {}),
  }));
}

// -------------------- LIST PRODUCTS --------------------

export async function listProducts() {
  const q = query(
    collection(db, "products"),
    orderBy("name", "asc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() || {}),
  }));
}

// -------------------- LIST ASSETS --------------------

export async function listAssets({
  productId = null,
  branchId = null,
} = {}) {
  const clauses = [];

  if (productId) {
    clauses.push(where("productId", "==", productId));
  }

  if (branchId) {
    clauses.push(where("branchId", "==", branchId));
  }

  const q = clauses.length
    ? query(collection(db, "assets"), ...clauses)
    : query(collection(db, "assets"));

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() || {}),
  }));
}

// -------------------- AVAILABLE ASSETS FOR DATE RANGE --------------------

export async function listAvailableAssetsForRange({
  productId = null,
  branchId = null,
  from,
  to,
} = {}) {
  if (!from || !to) {
    throw new Error("from and to dates are required");
  }

  const clauses = [];

  if (productId) {
    clauses.push(where("productId", "==", productId));
  }

  if (branchId) {
    clauses.push(where("branchId", "==", branchId));
  }

  const q = clauses.length
    ? query(collection(db, "assets"), ...clauses)
    : query(collection(db, "assets"));

  const snap = await getDocs(q);

  return snap.docs
    .map((d) => ({
      id: d.id,
      ...(d.data() || {}),
    }))
    .filter((asset) => {
      // Never rentable
      if (
        asset.status === "out_for_rental" ||
        asset.status === "maintenance"
      ) {
        return false;
      }

      // No reservation means available
      if (!asset.reservation) return true;

      // Backward compatibility
      const rFrom = asset.reservation.from || null;

      const rTo =
        asset.reservation.to ||
        asset.reservation.until ||
        null;

      // Missing reservation dates means blocked
      if (!rFrom || !rTo) return false;

      // Block only if dates overlap
      const overlap = datesOverlap(
        from,
        to,
        rFrom,
        rTo
      );

      return !overlap;
    });
}

// -------------------- DEFAULT EXPORT --------------------

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
  listAvailableAssetsForRange,
  reserveAsset,
  unreserveAsset,
};