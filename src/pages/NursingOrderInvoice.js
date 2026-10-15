
const COMPANY = {
  name: "BOOKMYMEDICARE PRIVATE LIMITED",
  address:
    "Shop No. 10, Sun and Moon CHS, Rajendra Nagar, Datta Pada Road, Borivali (East), Mumbai - 400068",
  registration: "CDSCO-MFG/MD/2023/000462",
  cin: "U74999MH2021PTC353543",
  licences:
    "MH-MZ7-561792 | MH-MZ7-561793 | MH-MZ7-561794 | MH-MZ7-561795",
  phone: "7777066885",
  gstin: "27AAJCB5669E1ZF",
  state: "Maharashtra",
  stateCode: "27",
  email: "bookmymedicare@gmail.com",
  pan: "AAJCB5669E",
  bankName: "Indian Overseas Bank (IOB) (0119)",
  account: "020933000000119",
  branchIfsc: "Andheri West & IOBA0000209",
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateText = (value) => {
  const date = dateValue(value);
  return date
    ? date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";
};

const numberWords = (number) => {
  const n = Math.floor(Math.abs(Number(number) || 0));

  if (n === 0) return "Zero";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six",
    "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];

  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty",
    "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  const underThousand = (num) => {
    let out = "";

    if (num >= 100) {
      out += `${ones[Math.floor(num / 100)]} Hundred `;
    }

    num %= 100;

    if (num >= 20) {
      out += `${tens[Math.floor(num / 10)]} `;
      if (num % 10) out += `${ones[num % 10]} `;
    } else if (num > 0) {
      out += `${ones[num]} `;
    }

    return out.trim();
  };

  const units = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [1, ""],
  ];

  let remaining = n;
  const parts = [];

  units.forEach(([size, label]) => {
    const chunk = Math.floor(remaining / size);

    if (chunk) {
      parts.push(
        `${underThousand(chunk)}${label ? ` ${label}` : ""}`.trim()
      );
      remaining %= size;
    }
  });

  return parts.join(" ").trim();
};

const amountInWords = (amount) => {
  const value = Number(amount || 0);
  const rupees = Math.floor(Math.abs(value));
  const paise = Math.round((Math.abs(value) - rupees) * 100);

  return `INR ${numberWords(rupees)}${
    paise ? ` and ${numberWords(paise)} Paise` : ""
  } Only`;
};

const getDurationLabel = (item) => {
  const start = dateValue(item.expectedStartDate);
  const end = dateValue(item.expectedEndDate);

  if (!start || !end) return "";

  const startDay = new Date(
    start.getFullYear(), start.getMonth(), start.getDate()
  );

  const endDay = new Date(
    end.getFullYear(), end.getMonth(), end.getDate()
  );

  const days = Math.max(
    1,
    Math.floor((endDay - startDay) / 86400000) + 1
  );

  return `${dateText(start)} to ${dateText(end)} (${days} ${
    days === 1 ? "Day" : "Days"
  })`;
};

const buildInvoiceHtml = (order, copyLabel) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const storedTotals = order.totals || {};

  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(
        item.amount ??
        (Number(item.qty || 0) * Number(item.rate || 0))
      ),
    0
  );

  const discount = Number(
    storedTotals.discountAmount ?? storedTotals.discount ?? 0
  );

  const taxesList = Array.isArray(storedTotals.taxBreakdown)
    ? storedTotals.taxBreakdown
    : Array.isArray(storedTotals.taxes)
      ? storedTotals.taxes
      : [];

  const taxes = taxesList.reduce(
    (sum, tax) => sum + Number(tax.amount || 0),
    0
  );

  const total = Number(
    storedTotals.total ?? (subtotal - discount + taxes)
  );

  const payments = Array.isArray(order.payments) ? order.payments : [];

  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const balance = Math.max(0, total - totalPaid);

  const invoiceNo =
    order.invoiceNo || order.orderNo || order.id || "—";

  const invoiceDate = dateText(
    order.invoiceDate || order.createdAt || new Date()
  );

  const customerName =
    order.customerName || order.deliveryContact?.name || "—";

  const address =
    order.deliveryAddress ||
    order.deliveryContact?.address ||
    "—";

  const phone =
    order.customerPhone || order.deliveryContact?.phone || "";

  const email =
    order.customerEmail || order.deliveryContact?.email || "";

  const serviceLabel =
    order.invoiceKind === "rental" ||
    order.serviceType === "rental"
      ? "Medical Equipment Rental"
      : order.serviceType === "caretaker"
        ? "Caretaker Service"
        : "Medical Equipment / Order Items";

  const validStarts = items
    .map((item) => dateValue(item.expectedStartDate))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const validEnds = items
    .map((item) => dateValue(item.expectedEndDate))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const servicePeriod =
    validStarts.length && validEnds.length
      ? `${dateText(validStarts[0])} to ${dateText(
          validEnds[validEnds.length - 1]
        )}`
      : "—";

  const paymentTerms =
    order.paymentTerms ||
    (balance <= 0
      ? "Paid"
      : totalPaid > 0
        ? "Part Payment"
        : "Advance Payment");

  const itemRows = items.length
    ? items.map((item, index) => {
        const qty = Number(item.qty || 1);
        const amount = Number(
          item.amount ?? qty * Number(item.rate || 0)
        );

        const rate = Number(
          item.rate ?? (qty ? amount / qty : amount)
        );

        const duration = getDurationLabel(item);

        const description = `
          <strong>${escapeHtml(item.name || item.description || "Order Item")}</strong>
          ${
            item.description && item.name
              ? `<div class="subline">${escapeHtml(item.description)}</div>`
              : ""
          }
          ${
            duration
              ? `<div class="subline">Period: ${escapeHtml(duration)}</div>`
              : ""
          }
        `;

        return `
          <tr>
            <td class="center">${index + 1}</td>
            <td>${description}</td>
            <td class="center">${escapeHtml(item.hsnSac || item.sac || "")}</td>
            <td class="center">${qty}</td>
            <td class="number">${money(rate)}</td>
            <td class="center">Unit</td>
            <td class="number">${money(amount)}</td>
          </tr>
        `;
      }).join("")
    : `
      <tr>
        <td class="center">1</td>
        <td>${escapeHtml(serviceLabel)}</td>
        <td></td><td></td><td></td><td></td>
        <td class="number">${money(total)}</td>
      </tr>
    `;

  const taxRows = taxesList.map((tax) => `
    <tr>
      <td colspan="6" class="summary-label">
        ${escapeHtml(tax.name || tax.label || tax.type || "Tax")}
      </td>
      <td class="number">${money(tax.amount)}</td>
    </tr>
  `).join("");

  return `
    <section class="invoice-page">
      <div class="invoice-title">
        <strong>Tax Invoice</strong>
        <em>(${escapeHtml(copyLabel)})</em>
      </div>

      <div class="top-grid">
        <div class="company-block">
          <strong class="company-name">${escapeHtml(COMPANY.name)}</strong>
          <div>${escapeHtml(COMPANY.address)}</div>
          <div>${escapeHtml(COMPANY.registration)}</div>
          <div>CIN: ${escapeHtml(COMPANY.cin)}</div>
          <div>DL LIC: ${escapeHtml(COMPANY.licences)}</div>
          <div>CONTACT NO. ${escapeHtml(COMPANY.phone)}</div>
          <div>GSTIN/UIN: ${escapeHtml(COMPANY.gstin)}</div>
          <div>State Name: ${escapeHtml(COMPANY.state)}, Code: ${escapeHtml(COMPANY.stateCode)}</div>
          <div>E-Mail: ${escapeHtml(COMPANY.email)}</div>
        </div>

        <div class="meta-grid">
          <div><span>Invoice No.</span><strong>${escapeHtml(invoiceNo)}</strong></div>
          <div><span>Dated</span><strong>${escapeHtml(invoiceDate)}</strong></div>
          <div><span>Delivery Note</span><strong>—</strong></div>
          <div><span>Mode/Terms of Payment</span><strong>${escapeHtml(paymentTerms)}</strong></div>
          <div><span>Reference No. & Date</span><strong>${escapeHtml(order.orderNo || order.id || "—")}<br>${escapeHtml(invoiceDate)}</strong></div>
          <div><span>Other References</span><strong>—</strong></div>
          <div><span>Buyer's Order No.</span><strong>${escapeHtml(order.orderNo || "—")}</strong></div>
          <div><span>Destination</span><strong>${escapeHtml(order.destination || "—")}</strong></div>
        </div>
      </div>

      <div class="address-grid">
        ${["Consignee (Ship to)", "Buyer (Bill to)"].map((label) => `
          <div>
            <b>${label}</b>
            <strong>${escapeHtml(customerName)}</strong>
            <div>${escapeHtml(address)}</div>
            ${phone ? `<div>Phone: ${escapeHtml(phone)}</div>` : ""}
            ${email ? `<div>Email: ${escapeHtml(email)}</div>` : ""}
            <div>State Name: ${escapeHtml(order.customerState || COMPANY.state)}, Code: ${escapeHtml(order.customerStateCode || COMPANY.stateCode)}</div>
          </div>
        `).join("")}
      </div>

      <div class="terms">
        <b>Terms of Delivery</b>
        <strong>${escapeHtml(serviceLabel)}</strong>
        <div>Period: ${escapeHtml(servicePeriod)}</div>
        <div>${escapeHtml(paymentTerms)}</div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Sl No.</th>
            <th>Description of Goods / Services</th>
            <th>HSN/SAC</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Per</th>
            <th>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="6" class="summary-label">Subtotal</td>
            <td class="number">${money(subtotal)}</td>
          </tr>
          ${
            discount
              ? `<tr><td colspan="6" class="summary-label">Discount</td><td class="number">-${money(discount)}</td></tr>`
              : ""
          }
          ${taxRows}
          <tr>
            <td colspan="6" class="summary-label">Total</td>
            <td class="number">₹ ${money(total)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="amount-words">
        <b>Amount Chargeable (in words)</b>
        <strong>${escapeHtml(amountInWords(total))}</strong>
        <em>E. & O.E.</em>
      </div>

      <div class="bottom-grid">
        <div class="declaration">
          <b>Company's PAN: ${escapeHtml(COMPANY.pan)}</b>
          <h4>Declaration</h4>
          <p>
            We hereby certify that the particulars given above are true
            and correct and that the amount indicated represents the
            charges for the items described in this invoice.
          </p>
          <p>This is a computer-generated invoice.</p>
        </div>

        <div class="bank">
          <h4>Company's Bank Details</h4>
          <div>Bank Name: <strong>${escapeHtml(COMPANY.bankName)}</strong></div>
          <div>A/c No.: <strong>${escapeHtml(COMPANY.account)}</strong></div>
          <div>Branch & IFSC Code: <strong>${escapeHtml(COMPANY.branchIfsc)}</strong></div>
          <div class="signatory">
            for ${escapeHtml(COMPANY.name)}
            <br><br><br>Authorised Signatory
          </div>
        </div>
      </div>

      <div class="footer-note">
        ${escapeHtml(COMPANY.name)} · This is a computer-generated invoice
      </div>
    </section>
  `;
};

export function generateNursingInvoice(order) {
  if (!order) {
    window.alert("Order details are not available.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=1100,height=850");

  if (!printWindow) {
    window.alert("Please allow pop-ups to generate the invoice.");
    return;
  }

  const html = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Invoice ${escapeHtml(order.invoiceNo || order.orderNo || order.id || "")}</title>

      <style>
        @page { size: A4; margin: 9mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          color: #111;
          font-size: 9px;
        }
        .invoice-page {
          min-height: 275mm;
          display: flex;
          flex-direction: column;
          page-break-after: always;
          border: 1px solid #555;
          padding: 7px;
        }
        .invoice-page:last-child { page-break-after: auto; }
        .invoice-title {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #444;
          padding-bottom: 5px;
          font-size: 13px;
        }
        .invoice-title em { font-size: 10px; }
        .top-grid {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          border-bottom: 1px solid #555;
        }
        .company-block {
          padding: 7px 6px;
          border-right: 1px solid #555;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }
        .company-name {
          display: block;
          font-size: 11px;
          margin-bottom: 2px;
        }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; }
        .meta-grid > div {
          min-height: 30px;
          padding: 4px 5px;
          border-bottom: 1px solid #bbb;
          border-left: 1px solid #bbb;
        }
        .meta-grid span { display: block; color: #444; margin-bottom: 2px; }
        .meta-grid strong { font-size: 9px; }
        .address-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 1px solid #555;
        }
        .address-grid > div {
          padding: 7px;
          line-height: 1.45;
          min-height: 76px;
          overflow-wrap: anywhere;
        }
        .address-grid > div + div { border-left: 1px solid #555; }
        .address-grid b, .address-grid strong { display: block; }
        .address-grid strong { margin-top: 5px; }
        .terms {
          padding: 6px 7px;
          border-bottom: 1px solid #555;
          line-height: 1.5;
        }
        .terms b, .terms strong { display: block; }
        table { width: 100%; border-collapse: collapse; }
        .items-table { flex: 1; }
        .items-table th, .items-table td {
          border: 1px solid #555;
          padding: 5px 4px;
          vertical-align: top;
        }
        .items-table th {
          text-align: center;
          font-weight: bold;
          background: #f4f4f4;
        }
        .items-table tbody { height: 75mm; }
        .items-table .number { text-align: right; white-space: nowrap; }
        .center { text-align: center; }
        .subline { margin-top: 3px; font-size: 8px; color: #333; }
        .summary-label { text-align: right; font-weight: bold; }
        .amount-words {
          padding: 6px;
          border-bottom: 1px solid #555;
          position: relative;
          min-height: 42px;
        }
        .amount-words b, .amount-words strong {
          display: block;
          margin-bottom: 4px;
        }
        .amount-words em { position: absolute; right: 6px; bottom: 5px; }
        .bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 90px;
        }
        .declaration, .bank { padding: 7px; line-height: 1.45; }
        .declaration { border-right: 1px solid #555; }
        .declaration h4, .bank h4 { margin: 5px 0; }
        .declaration p { margin: 4px 0; }
        .signatory {
          text-align: right;
          border-top: 1px solid #aaa;
          margin-top: 8px;
          padding-top: 5px;
          font-weight: bold;
        }
        .footer-note {
          text-align: center;
          margin-top: auto;
          padding-top: 5px;
          font-size: 8px;
        }
        .print-toolbar {
          display: flex;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          background: #eee;
        }
        .print-toolbar button {
          padding: 8px 16px;
          border: 0;
          border-radius: 4px;
          cursor: pointer;
        }
        @media screen {
          body { background: #ddd; }
          .invoice-page {
            width: 190mm;
            margin: 12px auto;
            background: white;
            box-shadow: 0 2px 12px #999;
          }
        }
        @media print {
          .print-toolbar { display: none; }
          .invoice-page { min-height: 275mm; box-shadow: none; margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="print-toolbar">
        <button onclick="window.print()">Print / Save as PDF</button>
        <button onclick="window.close()">Close</button>
      </div>

      ${buildInvoiceHtml(order, "ORIGINAL FOR RECIPIENT")}
      ${buildInvoiceHtml(order, "DUPLICATE FOR SUPPLIER")}

      <script>
        window.onload = () => {
          setTimeout(() => window.print(), 350);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
