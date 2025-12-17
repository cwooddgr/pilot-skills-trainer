// Spatial orientation task generation for Module D
// Assessment-safe: uses geometric shapes and abstract representations

export interface SpatialTask {
  variant: 'mental-rotation'
  stimulus: MentalRotationStimulus
  correctAnswer: number
  options: MentalRotationOption[]
  difficulty: number
}

export interface MentalRotationStimulus {
  shapePoints: Point2D[]
  referenceRotation: number
}

export interface MentalRotationOption {
  rotation: number
  isMirrored: boolean
}

export interface Point2D {
  x: number
  y: number
}

/**
 * Generate a mental rotation task
 */
export function generateSpatialTask(
  _variant: 'mental-rotation',
  difficulty: number
): SpatialTask {
  return generateMentalRotationTask(difficulty)
}

/**
 * Pre-defined asymmetric shapes that are easy to distinguish when rotated
 */
const ASYMMETRIC_SHAPES: Point2D[][] = [
  // F-shape
  [
    { x: 0, y: 0 },
    { x: 0, y: 4 },
    { x: 2, y: 4 },
    { x: 2, y: 3 },
    { x: 1, y: 3 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ],
  // L-shape with notch
  [
    { x: 0, y: 0 },
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 0 },
  ],
  // Asymmetric arrow (notch on one side)
  [
    { x: 1.2, y: 0 },
    { x: 0, y: 1.2 },
    { x: 0.6, y: 1.2 },
    { x: 0.6, y: 2 },
    { x: 0.3, y: 2 },
    { x: 0.3, y: 3 },
    { x: 1.5, y: 3 },
    { x: 1.5, y: 1.2 },
    { x: 2, y: 1.2 },
  ],
  // P-shape
  [
    { x: 0, y: 0 },
    { x: 0, y: 4 },
    { x: 2, y: 4 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
    { x: 1, y: 0 },
  ],
  // 7-shape
  [
    { x: 0, y: 3 },
    { x: 0, y: 4 },
    { x: 2, y: 4 },
    { x: 2, y: 3 },
    { x: 1.5, y: 3 },
    { x: 0.5, y: 0 },
    { x: 0, y: 0 },
    { x: 0.5, y: 2.5 },
  ],
]

/**
 * Generate a mental rotation task
 * User must identify which option matches the reference shape (same rotation, not mirrored)
 */
function generateMentalRotationTask(difficulty: number): SpatialTask {
  // Select a random shape
  const shapeIndex = Math.floor(Math.random() * ASYMMETRIC_SHAPES.length)
  const baseShape = ASYMMETRIC_SHAPES[shapeIndex]

  // Reference is always shown at a random starting rotation
  const referenceRotation = Math.floor(Math.random() * 4) * 90 // 0, 90, 180, or 270

  // Determine rotation step based on difficulty
  // Lower difficulty = 90° steps (easier to distinguish)
  // Higher difficulty = 45° steps (harder)
  const rotationStep = difficulty < 0.5 ? 90 : 45
  const possibleRotations = Array.from(
    { length: 360 / rotationStep },
    (_, i) => i * rotationStep
  )

  // Target rotation (what the correct answer should be)
  // This is the SAME as reference rotation (the task is to find the match)
  const targetRotation = referenceRotation

  // Generate options
  const numOptions = 4
  const correctIndex = Math.floor(Math.random() * numOptions)
  const options: MentalRotationOption[] = []

  // Build list of all possible unique options (rotation + mirror combinations)
  const allPossibleOptions: MentalRotationOption[] = []
  for (const rot of possibleRotations) {
    allPossibleOptions.push({ rotation: rot, isMirrored: false })
    allPossibleOptions.push({ rotation: rot, isMirrored: true })
  }

  // Remove the correct answer from distractor pool
  const distractorPool = allPossibleOptions.filter(
    (opt) => !(opt.rotation === targetRotation && opt.isMirrored === false)
  )

  // Shuffle distractor pool
  for (let i = distractorPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[distractorPool[i], distractorPool[j]] = [distractorPool[j], distractorPool[i]]
  }

  // Prioritize distractors based on difficulty:
  // Higher difficulty = prefer mirrored at same rotation (hardest to detect)
  // Lower difficulty = prefer different rotations (easier)
  distractorPool.sort((a, b) => {
    const aIsMirroredSameRot = a.isMirrored && a.rotation === targetRotation
    const bIsMirroredSameRot = b.isMirrored && b.rotation === targetRotation
    const aIsDiffRot = a.rotation !== targetRotation && !a.isMirrored

    if (difficulty > 0.5) {
      // High difficulty: prefer mirrored at same rotation
      if (aIsMirroredSameRot && !bIsMirroredSameRot) return -1
      if (!aIsMirroredSameRot && bIsMirroredSameRot) return 1
    } else {
      // Low difficulty: prefer different rotation, not mirrored
      if (aIsDiffRot && !b.isMirrored) return -1
      if (!a.isMirrored && b.isMirrored) return -1
    }
    return 0
  })

  // Build options array
  for (let i = 0; i < numOptions; i++) {
    if (i === correctIndex) {
      options.push({ rotation: targetRotation, isMirrored: false })
    } else {
      // Take next available distractor
      const distractor = distractorPool.shift()
      if (distractor) {
        options.push(distractor)
      } else {
        // Fallback: shouldn't happen with enough rotations
        options.push({ rotation: (targetRotation + 90) % 360, isMirrored: true })
      }
    }
  }

  return {
    variant: 'mental-rotation',
    stimulus: { shapePoints: baseShape, referenceRotation },
    correctAnswer: correctIndex,
    options,
    difficulty,
  }
}

/**
 * Rotate a point around the origin
 */
export function rotatePoint(point: Point2D, angleDegrees: number): Point2D {
  const rad = (angleDegrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

/**
 * Mirror a point across the Y axis
 */
export function mirrorPoint(point: Point2D): Point2D {
  return { x: -point.x, y: point.y }
}

/**
 * Transform shape points with rotation and optional mirror
 */
export function transformShape(
  points: Point2D[],
  rotation: number,
  mirror: boolean
): Point2D[] {
  // Center the shape first
  const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length

  return points.map((p) => {
    // Center
    let transformed = { x: p.x - centerX, y: p.y - centerY }
    // Mirror if needed
    if (mirror) {
      transformed = mirrorPoint(transformed)
    }
    // Rotate
    transformed = rotatePoint(transformed, rotation)
    return transformed
  })
}
