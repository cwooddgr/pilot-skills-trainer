import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type {
  UserProfile,
  HardwareProfile,
  Session,
  ModuleRun,
  Trial,
} from '@/types'

interface PilotSkillsDB extends DBSchema {
  userProfiles: {
    key: string
    value: UserProfile
    indexes: { 'by-lastActive': number }
  }
  hardwareProfiles: {
    key: string
    value: HardwareProfile
    indexes: { 'by-lastCalibrated': number }
  }
  sessions: {
    key: string
    value: Session
    indexes: { 'by-timestamp': number; 'by-user': string }
  }
  moduleRuns: {
    key: string
    value: ModuleRun
    indexes: { 'by-session': string; 'by-module': string }
  }
  trials: {
    key: string
    value: Trial
    indexes: { 'by-moduleRun': string; 'by-timestamp': number }
  }
}

const DB_NAME = 'pilot-skills-trainer'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<PilotSkillsDB> | null = null

async function getDB(): Promise<IDBPDatabase<PilotSkillsDB>> {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await openDB<PilotSkillsDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // User profiles store
      if (!db.objectStoreNames.contains('userProfiles')) {
        const userStore = db.createObjectStore('userProfiles', { keyPath: 'id' })
        userStore.createIndex('by-lastActive', 'lastActive')
      }

      // Hardware profiles store
      if (!db.objectStoreNames.contains('hardwareProfiles')) {
        const hwStore = db.createObjectStore('hardwareProfiles', {
          keyPath: 'id',
        })
        hwStore.createIndex('by-lastCalibrated', 'lastCalibrated')
      }

      // Sessions store
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' })
        sessionStore.createIndex('by-timestamp', 'timestamp')
        sessionStore.createIndex('by-user', 'userProfileId')
      }

      // Module runs store
      if (!db.objectStoreNames.contains('moduleRuns')) {
        const runStore = db.createObjectStore('moduleRuns', { keyPath: 'id' })
        runStore.createIndex('by-session', 'sessionId')
        runStore.createIndex('by-module', 'moduleId')
      }

      // Trials store
      if (!db.objectStoreNames.contains('trials')) {
        const trialStore = db.createObjectStore('trials', { keyPath: 'id' })
        trialStore.createIndex('by-moduleRun', 'moduleRunId')
        trialStore.createIndex('by-timestamp', 'startTimestamp')
      }
    },
  })

  return dbInstance
}

// User Profile operations
export async function createUserProfile(
  profile: UserProfile
): Promise<UserProfile> {
  const db = await getDB()
  await db.add('userProfiles', profile)
  return profile
}

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  const db = await getDB()
  const profile = await db.get('userProfiles', id)
  return profile || null
}

export async function getAllUserProfiles(): Promise<UserProfile[]> {
  const db = await getDB()
  return db.getAll('userProfiles')
}

export async function updateUserProfile(
  profile: UserProfile
): Promise<UserProfile> {
  const db = await getDB()
  await db.put('userProfiles', profile)
  return profile
}

export async function deleteUserProfile(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('userProfiles', id)
}

// Hardware Profile operations
export async function createHardwareProfile(
  profile: HardwareProfile
): Promise<HardwareProfile> {
  const db = await getDB()
  await db.add('hardwareProfiles', profile)
  return profile
}

export async function getHardwareProfile(
  id: string
): Promise<HardwareProfile | null> {
  const db = await getDB()
  const profile = await db.get('hardwareProfiles', id)
  return profile || null
}

export async function updateHardwareProfile(
  profile: HardwareProfile
): Promise<HardwareProfile> {
  const db = await getDB()
  await db.put('hardwareProfiles', profile)
  return profile
}

export async function deleteHardwareProfile(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('hardwareProfiles', id)
}

// Session operations
export async function createSession(session: Session): Promise<Session> {
  const db = await getDB()
  await db.add('sessions', session)
  return session
}

export async function getSession(id: string): Promise<Session | null> {
  const db = await getDB()
  const session = await db.get('sessions', id)
  return session || null
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB()
  return db.getAllFromIndex('sessions', 'by-timestamp')
}

export async function getSessionsByUser(userId: string): Promise<Session[]> {
  const db = await getDB()
  return db.getAllFromIndex('sessions', 'by-user', userId)
}

export async function updateSession(session: Session): Promise<Session> {
  const db = await getDB()
  await db.put('sessions', session)
  return session
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('sessions', id)
}

// Module Run operations
export async function createModuleRun(run: ModuleRun): Promise<ModuleRun> {
  const db = await getDB()
  await db.add('moduleRuns', run)
  return run
}

export async function getModuleRun(id: string): Promise<ModuleRun | null> {
  const db = await getDB()
  const run = await db.get('moduleRuns', id)
  return run || null
}

export async function updateModuleRun(run: ModuleRun): Promise<ModuleRun> {
  const db = await getDB()
  await db.put('moduleRuns', run)
  return run
}

// Trial operations
export async function createTrial(trial: Trial): Promise<Trial> {
  const db = await getDB()
  await db.add('trials', trial)
  return trial
}

export async function getTrial(id: string): Promise<Trial | null> {
  const db = await getDB()
  const trial = await db.get('trials', id)
  return trial || null
}

export async function updateTrial(trial: Trial): Promise<Trial> {
  const db = await getDB()
  await db.put('trials', trial)
  return trial
}

export async function getTrialsByModuleRun(moduleRunId: string): Promise<Trial[]> {
  const db = await getDB()
  return db.getAllFromIndex('trials', 'by-moduleRun', moduleRunId)
}

export async function getAllTrials(): Promise<Trial[]> {
  const db = await getDB()
  return db.getAll('trials')
}

export async function getAllModuleRuns(): Promise<ModuleRun[]> {
  const db = await getDB()
  return db.getAll('moduleRuns')
}

// Bulk export for data export functionality
export async function exportAllData(): Promise<{
  userProfiles: UserProfile[]
  hardwareProfiles: HardwareProfile[]
  sessions: Session[]
  moduleRuns: ModuleRun[]
  trials: Trial[]
}> {
  const db = await getDB()

  const [userProfiles, hardwareProfiles, sessions, moduleRuns, trials] =
    await Promise.all([
      db.getAll('userProfiles'),
      db.getAll('hardwareProfiles'),
      db.getAll('sessions'),
      db.getAll('moduleRuns'),
      db.getAll('trials'),
    ])

  return {
    userProfiles,
    hardwareProfiles,
    sessions,
    moduleRuns,
    trials,
  }
}

// Clear all data (useful for testing)
export async function clearAllData(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    ['userProfiles', 'hardwareProfiles', 'sessions', 'moduleRuns', 'trials'],
    'readwrite'
  )

  await Promise.all([
    tx.objectStore('userProfiles').clear(),
    tx.objectStore('hardwareProfiles').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('moduleRuns').clear(),
    tx.objectStore('trials').clear(),
  ])

  await tx.done
}
