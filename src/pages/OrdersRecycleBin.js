import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  addDoc,
  serverTimestamp,
  getDocs,
  setDoc,
  where,
} from "firebase/firestore";

import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

import OrderDrawer from "../components/OrderDrawer";

import { listBranches } from "../utils/inventory";

import "./Orders.css";

const fmtCurrency = (v) => {
  try {
    return Number(v).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch {
    return v ?? "0.00";
  }
};

export default function OrdersRecycleBin() {

  const navigate = useNavigate();

  const [orders,setOrders] = useState([]);
  const [selectedOrder,setSelectedOrder] = useState(null);

  const [productsMap,setProductsMap] = useState({});
  const [productsList,setProductsList] = useState([]);

  const [branches,setBranches] = useState([]);
  const [drivers,setDrivers] = useState([]);

  const [assetsById,setAssetsById] = useState({});

  const [assetPicker,setAssetPicker] = useState({
    open:false
  });

  const [paymentModal,setPaymentModal] = useState({
    open:false
  });

  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");

  /* ---------------------------------------------------- */
  /* LOAD DELETED ORDERS                                  */
  /* ---------------------------------------------------- */

  useEffect(()=>{

    const q = query(
      collection(db,"orders_recycle_bin"),
      orderBy("deletedAt","desc")
    );

    const unsub = onSnapshot(q,(snap)=>{

      const docs = snap.docs.map(d=>({
        id:d.id,
        ...(d.data() || {})
      }));

      setOrders(docs);

    });

    return ()=>unsub();

  },[]);

  /* ---------------------------------------------------- */
  /* LOAD PRODUCTS                                        */
  /* ---------------------------------------------------- */

  useEffect(()=>{

    const loadProducts = async ()=>{

      const snap = await getDocs(collection(db,"products"));

      const prods = snap.docs.map(d=>({
        id:d.id,
        ...(d.data() || {})
      }));

      const map = {};
      prods.forEach(p=>map[p.id] = p);

      setProductsMap(map);
      setProductsList(prods);

    };

    loadProducts();

  },[]);

  /* ---------------------------------------------------- */
  /* LOAD BRANCHES                                        */
  /* ---------------------------------------------------- */

  useEffect(()=>{

    const loadBranches = async ()=>{

      try{
        const b = await listBranches();
        setBranches(b || []);
      }catch(e){
        console.warn("branches load failed",e);
      }

    };

    loadBranches();

  },[]);

  /* ---------------------------------------------------- */
  /* LOAD DRIVERS                                         */
  /* ---------------------------------------------------- */

  useEffect(()=>{

    const loadDrivers = async ()=>{

      const snap = await getDocs(collection(db,"drivers"));

      const docs = snap.docs.map(d=>({
        id:d.id,
        ...(d.data() || {})
      }));

      setDrivers(docs);

    };

    loadDrivers();

  },[]);

  /* ---------------------------------------------------- */
  /* CLOSE DRAWER                                         */
  /* ---------------------------------------------------- */

  const closeOrder = ()=>{
    setSelectedOrder(null);
  };

  /* ---------------------------------------------------- */
  /* RESTORE ORDER                                        */
  /* ---------------------------------------------------- */
const restorePayments = async (orderId) => {

  const paymentsSnap = await getDocs(
    collection(db,"orders_recycle_bin",orderId,"payments")
  );

  for(const paymentDoc of paymentsSnap.docs){

    await setDoc(
      doc(
        db,
        "orders",
        orderId,
        "payments",
        paymentDoc.id
      ),
      paymentDoc.data()
    );

    await deleteDoc(
      doc(
        db,
        "orders_recycle_bin",
        orderId,
        "payments",
        paymentDoc.id
      )
    );

  }

};

const restoreOrder = async(order)=>{

  const ok = window.confirm(
    `Restore order ${order.orderNo || order.id}?`
  );

  if(!ok) return;

  try{

    setSaving(true);

    const {
      deletedAt,
      deletedBy,
      deletedByName,
      originalId,
      id,
      ...cleanOrder
    } = order;

    const orderId = originalId || order.id;

    // restore order
    await setDoc(
      doc(db,"orders",orderId),
      cleanOrder
    );
 await restorePayments(orderId);
    // remove from recycle bin
    await deleteDoc(
      doc(db,"orders_recycle_bin",orderId)
    );

    closeOrder();

  }catch(err){

    console.error(err);
    setError(err.message || "Failed to restore order");

  }finally{

    setSaving(false);

  }

};
  /* ---------------------------------------------------- */
  /* DELETE FOREVER                                       */
  /* ---------------------------------------------------- */

  const deleteForever = async(order)=>{

  const ok = window.confirm(
    `Delete permanently ${order.orderNo || order.id}?`
  );

  if(!ok) return;

  try{

    // 1️⃣ delete payments subcollection
    const paymentsSnap = await getDocs(
      collection(db,"orders_recycle_bin",order.id,"payments")
    );

    for(const paymentDoc of paymentsSnap.docs){

      await deleteDoc(
        doc(
          db,
          "orders_recycle_bin",
          order.id,
          "payments",
          paymentDoc.id
        )
      );

    }

    // 2️⃣ delete recycle bin order document
    await deleteDoc(
      doc(db,"orders_recycle_bin",order.id)
    );

    // 3️⃣ close drawer if open
    if(selectedOrder?.id === order.id){
      closeOrder();
    }

  }catch(err){

    console.error(err);
    setError(err.message || "Failed to delete order");

  }

};

  /* ---------------------------------------------------- */
  /* UI                                                   */
  /* ---------------------------------------------------- */

  return(

    <div className="orders-wrap">

      <header
        className="orders-header"
        style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center"
        }}
      >

        <h1>Orders Recycle Bin</h1>

        <button
          className="cp-btn"
          onClick={()=>navigate("/orders")}
        >
          ← Back to Orders
        </button>

      </header>

      {error && <div className="orders-error">{error}</div>}

      <table className="orders-table">

        <thead>

          <tr>
            <th>Order No</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Items</th>
            <th>Total</th>
            <th>Deleted At</th>
            <th>Actions</th>
          </tr>

        </thead>

        <tbody>

          {orders.map(o=>{

            return(

              <tr key={o.id}>

                <td className="strong">
                  {o.orderNo || o.id}
                </td>

                <td>
                  {o.customerName || "—"}
                </td>

                <td>
                  {o.status || "—"}
                </td>

                <td>
                  {(o.items || []).length}
                </td>

                <td>
                  {fmtCurrency(o.totals?.total || 0)}
                </td>

                <td>

                  {o.deletedAt?.seconds
                    ? new Date(o.deletedAt.seconds*1000).toLocaleString()
                    : "—"}

                </td>

                <td>

                  <div className="order-actions">

                    <button
                      className="order-action view"
                      onClick={()=>setSelectedOrder(o)}
                    >
                      View
                    </button>

                    <button
                      className="order-action restore"
                      onClick={()=>restoreOrder(o)}
                    >
                      Restore
                    </button>

                    <button
                      className="order-action delete"
                      onClick={()=>deleteForever(o)}
                    >
                      Delete Forever
                    </button>

                  </div>

                </td>

              </tr>

            );

          })}

          {orders.length === 0 && (

            <tr>

              <td colSpan="7" className="orders-empty">
                No deleted orders
              </td>

            </tr>

          )}

        </tbody>

      </table>

      {/* ORDER DRAWER */}

      {selectedOrder && (

        <OrderDrawer

          selectedOrder={selectedOrder}
          setSelectedOrder={setSelectedOrder}

          branches={branches}
          productsMap={productsMap}
          productsList={productsList}
          drivers={drivers}

          assetsById={assetsById}
          assetPicker={assetPicker}

          paymentModal={paymentModal}

          error={error}
          saving={saving}

          closeOrder={closeOrder}

          changeOrderStatus={()=>{}}
          updateOrderItem={()=>{}}

          openAssetPickerForItem={()=>{}}
          togglePickerSelect={()=>{}}
          confirmAssignAssetsFromPicker={()=>{}}

          checkoutAssignedAssetsForItem={()=>{}}
          unassignAsset={()=>{}}
          checkinAssignedAsset={()=>{}}

          assignDriverToOrder={()=>{}}

          driverAcceptDelivery={()=>{}}
          markPickedUp={()=>{}}
          markInTransit={()=>{}}
          markDelivered={()=>{}}
          confirmDeliveryAccepted={()=>{}}

          openPaymentModal={()=>{}}
          closePaymentModal={()=>{}}
          updatePaymentForm={()=>{}}
          savePayment={()=>{}}
          removePayment={()=>{}}
          markPaymentStatus={()=>{}}

          paymentSummary={{
            totalPaid:0,
            balance:0
          }}

          navigate={navigate}

        />

      )}

    </div>

  );

}