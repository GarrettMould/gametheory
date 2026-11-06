import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCVChub-iIH69tKk30C58WGT1VJW10r4PY',
  authDomain: 'gametheory-193cf.firebaseapp.com',
  projectId: 'gametheory-193cf',
  storageBucket: 'gametheory-193cf.firebasestorage.app',
  messagingSenderId: '645661142615',
  appId: '1:645661142615:web:35b9ebacb4a0316103fd12',
  measurementId: 'G-4VDWWD6F6X',
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
