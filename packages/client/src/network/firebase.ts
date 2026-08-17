// Firebase project init — the one shared backend both players' browsers connect to for
// online play and the global leaderboard. The apiKey etc. below are NOT secret (Firebase web
// config is meant to be public in client code; actual access control is enforced by
// Firestore security rules, not by hiding this object) — see console.firebase.google.com
// project settings. Same call Golf's/Durak's firebase.ts makes for their own projects.
//
// *** PLACEHOLDER — replace with a real project before online play/the leaderboard work. ***
// 1. Create a project at console.firebase.google.com (any name, e.g. "mexican-train-xxxxx").
// 2. Enable Firestore (Standard edition, any region).
// 3. Project Settings -> General -> Your apps -> add a Web app -> copy its config here.
// 4. Firestore -> Rules -> paste in this repo's firestore.rules -> Publish.
// Until then, "Play online" will fail to create/join a room, and the leaderboard button will
// just show "Loading…" forever — local (vs-bots) play works with zero setup either way.
import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.firebasestorage.app',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

const app = initializeApp(firebaseConfig);
// The engine's GameState has several optional fields (PlayerState.personality, Train.ownerId,
// openDouble, etc.) that come through as `undefined` rather than omitted mid-game — Firestore
// rejects `undefined` field values by default, so this tells it to silently drop them instead
// of throwing on every game-state write.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
