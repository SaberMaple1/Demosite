/* ============================================================
   Pickago – Firebase settings (shared by the Student and Admin pages)
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyCy1SCgPGuVPOCBNgdtazFmYUSzolV82Fc",
  authDomain: "pickago-f13b6.firebaseapp.com",
  projectId: "pickago-f13b6",
  storageBucket: "pickago-f13b6.firebasestorage.app",
  messagingSenderId: "462671261112",
  appId: "1:462671261112:web:e9f9ae3564d37a1234334d",
};

/* >>> CHANGE THIS to the canteen manager's email (the one you added
       in Firebase > Authentication > Users). Also put the SAME email
       in firestore.rules (search for CHANGE_ME). <<< */
const ADMIN_EMAIL = "CHANGE_ME@gmail.com";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const isAdminEmail = (e) => String(e || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
const fbErr = (x) => {
  const c = (x && x.code) || "";
  if (c === "auth/email-already-in-use") return "An account already exists with this Gmail.";
  if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password", "auth/invalid-email"].includes(c))
    return "Incorrect Gmail or password.";
  if (c === "auth/too-many-requests") return "Too many tries. Please wait a few minutes.";
  if (c === "auth/network-request-failed") return "No internet connection.";
  if (c === "auth/weak-password") return "Password is too weak.";
  return "Something went wrong. Please try again.";
};
