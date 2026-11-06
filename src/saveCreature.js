import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

function saveErrorMessage(error) {
  const code = error?.code ?? ''

  if (code === 'permission-denied') {
    return 'Firebase blocked this save. Check the Firestore rules for the creatures collection.'
  }

  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'Could not reach Firestore. Create a Cloud Firestore database for project gametheory-193cf, then try again.'
  }

  return error?.message || 'Could not submit this creature.'
}

export async function saveCreature(creature) {
  try {
    const saved = await addDoc(collection(db, 'creatures'), {
      studentNames: creature.studentNames,
      period: creature.period,
      speciesName: creature.speciesName,
      archetype: creature.archetype,
      size: creature.size,
      efficiency: creature.efficiency,
      agility: creature.agility,
      adaptation: creature.adaptation,
      traitCards: creature.traitCards,
      story: creature.story,
      createdAt: serverTimestamp(),
    })

    return { ok: true, id: saved.id, creature }
  } catch (error) {
    return {
      ok: false,
      creature,
      message: saveErrorMessage(error),
    }
  }
}
