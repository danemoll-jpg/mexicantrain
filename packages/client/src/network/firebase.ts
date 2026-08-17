// Firebase project init — the one shared backend both players' browsers connect to for
// online play and the global leaderboard. The apiKey etc. below are NOT secret (Firebase web
// config is meant to be public in client code; actual access control is enforced by
// Firestore security rules, not by hiding this object) — see console.firebase.google.com
// project settings. Same call Golf's/Durak's firebase.ts makes for their own projects.
//
// Project: mexican-train-a8472.
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBWttrdinaMKxxf9_p5Rmn9VwZnKojPjBA',
  authDomain: 'mexican-train-a8472.firebaseapp.com',
  projectId: 'mexican-train-a8472',
  storageBucket: 'mexican-train-a8472.firebasestorage.app',
  messagingSenderId: '446225377235',
  appId: '1:446225377235:web:4d4461da95b9969a887126',
};

const app = initializeApp(firebaseConfig);
// The engine's GameState has several optional fields (PlayerState.personality, Train.ownerId,
// openDouble, etc.) that come through as `undefined` rather than omitted mid-game — Firestore
// rejects `undefined` field values by default, so this tells it to silently drop them instead
// of throwing on every game-state write.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
