import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase.js'

function loadErrorMessage(error) {
  const code = error?.code ?? ''

  if (code === 'permission-denied') {
    return 'Firebase blocked this list. Check the Firestore rules for the creatures collection.'
  }

  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'Could not reach Firestore. Create a Cloud Firestore database for project gametheory-193cf, then try again.'
  }

  return error?.message || 'Could not load submitted creatures.'
}

function asCreature(id, data) {
  return {
    id,
    studentNames: Array.isArray(data.studentNames) ? data.studentNames : [],
    period: data.period ?? '',
    speciesName: data.speciesName || 'Unnamed creature',
    archetype: data.archetype || '',
    size: Number(data.size) || 0,
    efficiency: Number(data.efficiency) || 0,
    agility: Number(data.agility) || 0,
    adaptation: data.adaptation || '',
    traitCards: Array.isArray(data.traitCards) ? data.traitCards : [],
    story: data.story || '',
  }
}

export async function loadCreatures() {
  try {
    const snapshot = await getDocs(collection(db, 'creatures'))
    const creatures = snapshot.docs
      .map((doc) => asCreature(doc.id, doc.data()))
      .sort((a, b) => a.speciesName.localeCompare(b.speciesName))

    return { ok: true, creatures }
  } catch (error) {
    return {
      ok: false,
      creatures: [],
      message: loadErrorMessage(error),
    }
  }
}
