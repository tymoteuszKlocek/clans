import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDEa_jsB9VrVZu54kbbEvGUhT1ylWdAZxo",
  authDomain: "social-network-app-9bac9.firebaseapp.com",
  projectId: "social-network-app-9bac9",
  storageBucket: "social-network-app-9bac9.firebasestorage.app",
  messagingSenderId: "870715839019",
  appId: "1:870715839019:web:f962174abf65cb8d51106e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);