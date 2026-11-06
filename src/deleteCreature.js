import { deleteDoc, doc } from 'firebase/firestore'
import { db } from './firebase.js'

function deleteErrorMessage(error) {
  const code = error?.code ?? ''

  if (code === 'permission-denied') {
    return 'Firebase blocked this delete. Allow delete on the creatures collection, then try again.'
  }

  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'Could not reach Firestore. Try again in a moment.'
  }

  return error?.message || 'Could not delete this creature.'
}

export async function deleteCreature(id) {
  try {
    await deleteDoc(doc(db, 'creatures', id))
    return { ok: true, id }
  } catch (error) {
    return {
      ok: false,
      id,
      message: deleteErrorMessage(error),
    }
  }
}
