// src/utils/payroll.js

/**
 * Groups staffAssignments by staff
 * Used for payroll generation
 */
export function groupAssignmentsByStaff(assignments = []) {
  const map = {};

  assignments.forEach((a) => {
    if (!a.staffId) return;

    if (!map[a.staffId]) {
      map[a.staffId] = {
        staffId: a.staffId,
        staffName: a.staffName || "",
        staffType: a.staffType || "",
        totalDays: 0,
        totalAmount: 0,
        assignments: [],
      };
    }

    const days = Number(a.days || 0);
    const amount = Number(a.amount || 0);

    map[a.staffId].totalDays += days;
    map[a.staffId].totalAmount += amount;

    map[a.staffId].assignments.push({
      assignmentId: a.id,
      orderId: a.orderId,
      orderNo: a.orderNo,
      startDate: a.startDate,
      endDate: a.endDate,
      days,
      rate: a.rate,
      amount,
    });
  });

  return Object.values(map);
}
