// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAjbnpYpKcAwp5eNBCLcIwRSSlJjNB7uFo",
  authDomain: "mdrent-38d1e.firebaseapp.com",
  projectId: "mdrent-38d1e",
  storageBucket: "mdrent-38d1e.firebasestorage.app",
  messagingSenderId: "670949336345",
  appId: "1:670949336345:web:2732a30869a9d07de35188",
  measurementId: "G-GKJCKHVNFQ"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
