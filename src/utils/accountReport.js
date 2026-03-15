import { doc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function updateAccountReport(updates) {

  const today = new Date().toISOString().slice(0, 10);

  const ref = doc(db, "reports_account_daily", today);

  await setDoc(
    ref,
    {
      date: today,
      updatedAt: serverTimestamp(),
      ...updates,
    },
    { merge: true }
  );
}