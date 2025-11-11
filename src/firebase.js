// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCBJcHWsUrZPDOji5d86td2e9ShrktcD48",
  authDomain: "medrent-5d771.firebaseapp.com",
  projectId: "medrent-5d771",
  storageBucket: "medrent-5d771.firebasestorage.app",
  messagingSenderId: "406243550899",
  appId: "1:406243550899:web:85bf331fe942d50dc7b2c6",
  measurementId: "G-CR7SZDPMPJ"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
