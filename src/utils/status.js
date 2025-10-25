// src/utils/status.js
// Shared helpers for consistent history & status propagation across Leads, Requirements, Quotations

import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

/**
 * STATUS_MAP_TO_LEAD is exported for visibility / future use.
 * Current propagation behavior (by your request) sets lead.status exactly to the newStatus passed.
 */
export const STATUS_MAP_TO_LEAD = {
  "quotation shared": "contacted",
  "order_created": "converted",
  "ready_for_quotation": "contacted",
  "sent": "contacted",
  "accepted": "converted",
  "rejected": "lost",
  "draft": "new",
};

/**
 * makeHistoryEntry
 *
 * Supports two calling styles:
 * 1) makeHistoryEntry(user, opts)   -- recommended
 * 2) makeHistoryEntry(opts)        -- legacy: will use auth.currentUser as user
 *
 * opts: { type, field, oldValue, newValue, note }
 */
export const makeHistoryEntry = (userOrOpts = {}, maybeOpts = {}) => {
  // Detect calling shape
  let user;
  let opts;
  if (userOrOpts && (userOrOpts.uid || userOrOpts.displayName || userOrOpts.email)) {
    // called as makeHistoryEntry(user, opts)
    user = userOrOpts;
    opts = maybeOpts || {};
  } else {
    // called as makeHistoryEntry(opts) — pick current user from auth
    user = auth.currentUser || {};
    opts = userOrOpts || {};
  }

  // Normalize fields
  const changedBy = user?.uid || "unknown";
  const changedByName = user?.displayName || user?.email || changedBy || "unknown";

  return {
    ts: new Date().toISOString(),
    changedBy,
    changedByName,
    type: opts.type || "update",
    field: opts.field || null,
    oldValue: opts.oldValue == null ? null : String(opts.oldValue),
    newValue: opts.newValue == null ? null : String(opts.newValue),
    note: opts.note || null,
  };
};

/**
 * propagateToLead(requirementId, fromType, oldStatus, newStatus, note)
 *
 * Behavior:
 *  - Reads requirement by id, finds req.leadId or req.lead
 *  - Appends a history entry to the lead.history using makeHistoryEntry
 *  - If newStatus is a non-empty string, sets lead.status = newStatus EXACTLY
 */
export const propagateToLead = async (requirementId, fromType, oldStatus, newStatus, note = "") => {
  if (!requirementId) return;
  try {
    const reqRef = doc(db, "requirements", requirementId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return;
    const req = reqSnap.data() || {};
    const leadId = req.leadId || req.lead || null;
    if (!leadId) return;

    const leadRef = doc(db, "leads", leadId);
    const user = auth.currentUser || {};

    // Use new flexible makeHistoryEntry signature; callers may pass opts-only in some places
    const leadEntry = makeHistoryEntry(user, {
      type: fromType || "propagate",
      field: "status",
      oldValue: oldStatus ?? "",
      newValue: newStatus ?? "",
      note: note || `Propagated from requirement ${requirementId}`,
    });

    // set status exactly to newStatus (no mapping) unless you later decide to map
    const updates = {
      history: arrayUnion(leadEntry),
      updatedAt: serverTimestamp(),
      updatedBy: user.uid || "",
      updatedByName: user.displayName || user.email || "",
    };

    if (typeof newStatus === "string" && newStatus.length > 0) {
      updates.status = newStatus;
    }

    await updateDoc(leadRef, updates);
  } catch (err) {
    console.error("propagateToLead error", err);
  }
};
