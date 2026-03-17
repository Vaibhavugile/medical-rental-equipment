export function assignAssetsWithLimit({
  existing = [],
  selected = [],
  qty = 0,
}) {
  const fresh = selected.filter((id) => !existing.includes(id));

  const remaining = Math.max(0, qty - existing.length);

  const toAdd = fresh.slice(0, remaining);

  return {
    merged: [...existing, ...toAdd],
    overflow: fresh.length > remaining,
  };
}