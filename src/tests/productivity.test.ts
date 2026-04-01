/**
 * ═══════════════════════════════════════════════════════════════
 *  TESTS UNITAIRES — Calcul de productivité TimeTrack
 *  Fichier : src/tests/productivity.test.ts
 * ═══════════════════════════════════════════════════════════════
 *
 *  Ce qu'on teste ici :
 *  1. getProductivityCategory — catégorisation d'un agent
 *  2. getProductivityScore    — score en % basé sur 8h/jour
 *  3. getProductivityColor    — couleur associée à la catégorie
 *  4. calcTeamProductivity    — productivité d'une équipe entière
 *  5. isWeekend               — détection weekend (pas de log attendu)
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────
//  Logique de productivité (extraite de l'app)
//  Référence : Section 07 du cahier technique
// ─────────────────────────────────────────────

const DAILY_OBJECTIVE_MINUTES = 480 // 8h = objectif journalier

type ProductivityCategory = 'Très Actif' | 'Actif' | 'Peu Actif' | 'Inactif'

function getProductivityCategory(totalMinutes: number): ProductivityCategory {
  const pct = (totalMinutes / DAILY_OBJECTIVE_MINUTES) * 100
  if (pct >= 100) return 'Très Actif'
  if (pct >= 75)  return 'Actif'
  if (pct >= 25)  return 'Peu Actif'
  return 'Inactif'
}

function getProductivityScore(totalMinutes: number): number {
  return Math.min(Math.round((totalMinutes / DAILY_OBJECTIVE_MINUTES) * 100), 100)
}

function getProductivityColor(category: ProductivityCategory): string {
  const colors: Record<ProductivityCategory, string> = {
    'Très Actif': '#22c55e',  // vert
    'Actif':      '#3b82f6',  // bleu
    'Peu Actif':  '#f59e0b',  // orange
    'Inactif':    '#ef4444',  // rouge
  }
  return colors[category]
}

function calcTeamProductivity(agents: { name: string, minutes: number }[]): {
  average: number,
  totalMinutes: number,
  distribution: Record<ProductivityCategory, number>
} {
  if (agents.length === 0) return {
    average: 0,
    totalMinutes: 0,
    distribution: { 'Très Actif': 0, 'Actif': 0, 'Peu Actif': 0, 'Inactif': 0 }
  }

  const totalMinutes = agents.reduce((sum, a) => sum + a.minutes, 0)
  const average = Math.round(totalMinutes / agents.length)
  const distribution: Record<ProductivityCategory, number> = {
    'Très Actif': 0, 'Actif': 0, 'Peu Actif': 0, 'Inactif': 0
  }
  agents.forEach(a => {
    distribution[getProductivityCategory(a.minutes)]++
  })
  return { average, totalMinutes, distribution }
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

// ═══════════════════════════════════════════════
//  SUITE 1 — getProductivityCategory
// ═══════════════════════════════════════════════
describe('getProductivityCategory — 3 catégories selon les heures loguées', () => {

  it('0 minutes → Inactif', () => {
    expect(getProductivityCategory(0)).toBe('Inactif')
  })

  it('119 minutes (< 25% de 8h) → Inactif', () => {
    expect(getProductivityCategory(119)).toBe('Inactif')
  })

  it('120 minutes (25% de 8h = seuil bas) → Peu Actif', () => {
    expect(getProductivityCategory(120)).toBe('Peu Actif')
  })

  it('240 minutes (50% de 8h) → Peu Actif', () => {
    expect(getProductivityCategory(240)).toBe('Peu Actif')
  })

  it('359 minutes (juste sous 75%) → Peu Actif', () => {
    expect(getProductivityCategory(359)).toBe('Peu Actif')
  })

  it('360 minutes (75% de 8h = seuil) → Actif', () => {
    expect(getProductivityCategory(360)).toBe('Actif')
  })

  it('420 minutes (87.5% de 8h) → Actif', () => {
    expect(getProductivityCategory(420)).toBe('Actif')
  })

  it('479 minutes (99.8% de 8h) → Actif', () => {
    expect(getProductivityCategory(479)).toBe('Actif')
  })

  it('480 minutes (exactement 8h = 100%) → Très Actif', () => {
    expect(getProductivityCategory(480)).toBe('Très Actif')
  })

  it('600 minutes (10h, dépassement) → Très Actif', () => {
    expect(getProductivityCategory(600)).toBe('Très Actif')
  })
})

// ═══════════════════════════════════════════════
//  SUITE 2 — getProductivityScore
// ═══════════════════════════════════════════════
describe('getProductivityScore — score en pourcentage (max 100%)', () => {

  it('0 minutes → 0%', () => {
    expect(getProductivityScore(0)).toBe(0)
  })

  it('240 minutes (4h) → 50%', () => {
    expect(getProductivityScore(240)).toBe(50)
  })

  it('360 minutes (6h) → 75%', () => {
    expect(getProductivityScore(360)).toBe(75)
  })

  it('480 minutes (8h) → 100%', () => {
    expect(getProductivityScore(480)).toBe(100)
  })

  it('600 minutes (10h) → 100% plafonné (pas de dépassement)', () => {
    expect(getProductivityScore(600)).toBe(100)
  })

  it('960 minutes (16h) → 100% plafonné', () => {
    expect(getProductivityScore(960)).toBe(100)
  })
})

// ═══════════════════════════════════════════════
//  SUITE 3 — getProductivityColor
// ═══════════════════════════════════════════════
describe('getProductivityColor — couleur associée à chaque catégorie', () => {

  it('Très Actif → vert (#22c55e)', () => {
    expect(getProductivityColor('Très Actif')).toBe('#22c55e')
  })

  it('Actif → bleu (#3b82f6)', () => {
    expect(getProductivityColor('Actif')).toBe('#3b82f6')
  })

  it('Peu Actif → orange (#f59e0b)', () => {
    expect(getProductivityColor('Peu Actif')).toBe('#f59e0b')
  })

  it('Inactif → rouge (#ef4444)', () => {
    expect(getProductivityColor('Inactif')).toBe('#ef4444')
  })
})

// ═══════════════════════════════════════════════
//  SUITE 4 — calcTeamProductivity
// ═══════════════════════════════════════════════
describe('calcTeamProductivity — productivité globale d\'une équipe', () => {

  it('équipe vide → average=0, totalMinutes=0', () => {
    const result = calcTeamProductivity([])
    expect(result.average).toBe(0)
    expect(result.totalMinutes).toBe(0)
  })

  it('un seul agent à 8h → average=480, 1 Très Actif', () => {
    const result = calcTeamProductivity([{ name: 'Alice', minutes: 480 }])
    expect(result.average).toBe(480)
    expect(result.totalMinutes).toBe(480)
    expect(result.distribution['Très Actif']).toBe(1)
    expect(result.distribution['Inactif']).toBe(0)
  })

  it('3 agents : 8h, 6h, 0h → calcul correct', () => {
    const agents = [
      { name: 'Alice',   minutes: 480 }, // Très Actif
      { name: 'Bob',     minutes: 360 }, // Actif
      { name: 'Charlie', minutes: 0   }, // Inactif
    ]
    const result = calcTeamProductivity(agents)
    expect(result.totalMinutes).toBe(840)
    expect(result.average).toBe(280)
    expect(result.distribution['Très Actif']).toBe(1)
    expect(result.distribution['Actif']).toBe(1)
    expect(result.distribution['Inactif']).toBe(1)
    expect(result.distribution['Peu Actif']).toBe(0)
  })

  it('la somme des distributions = nombre total d\'agents', () => {
    const agents = [
      { name: 'A', minutes: 500 },
      { name: 'B', minutes: 400 },
      { name: 'C', minutes: 200 },
      { name: 'D', minutes: 50  },
    ]
    const result = calcTeamProductivity(agents)
    const total = Object.values(result.distribution).reduce((a, b) => a + b, 0)
    expect(total).toBe(agents.length)
  })
})

// ═══════════════════════════════════════════════
//  SUITE 5 — isWeekend
// ═══════════════════════════════════════════════
describe('isWeekend — détection des jours non travaillés', () => {

  it('Samedi est un weekend', () => {
    const samedi = new Date('2025-03-01') // samedi
    expect(isWeekend(samedi)).toBe(true)
  })

  it('Dimanche est un weekend', () => {
    const dimanche = new Date('2025-03-02') // dimanche
    expect(isWeekend(dimanche)).toBe(true)
  })

  it('Lundi n\'est pas un weekend', () => {
    const lundi = new Date('2025-03-03') // lundi
    expect(isWeekend(lundi)).toBe(false)
  })

  it('Vendredi n\'est pas un weekend', () => {
    const vendredi = new Date('2025-02-28') // vendredi
    expect(isWeekend(vendredi)).toBe(false)
  })

  it('Mercredi n\'est pas un weekend', () => {
    const mercredi = new Date('2025-03-05') // mercredi
    expect(isWeekend(mercredi)).toBe(false)
  })
})
