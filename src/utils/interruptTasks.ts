/**
 * Interrupt task generation for Module G
 * Generates visual interrupts that require immediate classification
 */

export type InterruptType = 'circle' | 'square' | 'triangle' | 'star'
export type InterruptColor = 'red' | 'blue' | 'green' | 'yellow'

export interface Interrupt {
  id: number
  type: InterruptType
  color: InterruptColor
  correctKey: string
  appearTime: number
  responseWindow: number
}

export interface InterruptResponse {
  interruptId: number
  responseTime: number
  keyPressed: string
  correct: boolean
  missed: boolean
}

export interface InterruptSequence {
  interrupts: Interrupt[]
  baselineDuration: number
  totalDuration: number
}

/**
 * Generate a sequence of interrupts for a trial
 */
export function generateInterruptSequence(
  difficulty: number,
  totalDuration: number
): InterruptSequence {
  // Baseline period before first interrupt (5-8s for better UX)
  const baselineDuration = 5000 + Math.random() * 3000

  // Interrupt timing based on difficulty
  // Low: 5-7s between interrupts, 1500ms window
  // High: 2-3s between interrupts, 800ms window
  const minInterval = 2000 + (1 - difficulty) * 3000 // 2s-5s
  const maxInterval = 3000 + (1 - difficulty) * 4000 // 3s-7s
  const responseWindow = 800 + (1 - difficulty) * 700 // 800ms-1500ms

  const interrupts: Interrupt[] = []
  let currentTime = baselineDuration
  let interruptId = 0

  // Generate interrupts until we run out of time
  while (currentTime < totalDuration - 2000) {
    // Stop 2s before end
    const interrupt = generateInterrupt(interruptId, currentTime, responseWindow)
    interrupts.push(interrupt)

    // Next interrupt time (jittered)
    const interval = minInterval + Math.random() * (maxInterval - minInterval)
    currentTime += interval

    interruptId++
  }

  return {
    interrupts,
    baselineDuration,
    totalDuration,
  }
}

/**
 * Generate a single interrupt
 */
function generateInterrupt(
  id: number,
  appearTime: number,
  responseWindow: number
): Interrupt {
  const types: InterruptType[] = ['circle', 'square', 'triangle', 'star']
  const colors: InterruptColor[] = ['red', 'blue', 'green', 'yellow']

  // Select random type and color (always use all 4 colors for variety)
  const type = types[Math.floor(Math.random() * types.length)]
  const color = colors[Math.floor(Math.random() * colors.length)]

  // Map color to key (1-4)
  const colorToKey: Record<InterruptColor, string> = {
    red: '1',
    blue: '2',
    green: '3',
    yellow: '4',
  }

  return {
    id,
    type,
    color,
    correctKey: colorToKey[color],
    appearTime,
    responseWindow,
  }
}

/**
 * Get display name for interrupt type
 */
export function getInterruptTypeName(type: InterruptType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * Get display name for interrupt color
 */
export function getInterruptColorName(color: InterruptColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1)
}
