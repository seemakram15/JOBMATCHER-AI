import { describe, expect, it } from 'vitest'
import { mockCvs, mockJobs, mockProfile } from '../data/mockData'
import { computeMatch, experienceFit, filterAndSortJobs, normaliseSkill, scoreJobs } from './scoring'

describe('scoring engine', () => {
  it('normalises common skill aliases', () => {
    expect(normaliseSkill('ReactJS')).toBe('react')
    expect(normaliseSkill('Node.js')).toBe('nodejs')
    expect(normaliseSkill('Postgres')).toBe('postgresql')
  })

  it('gives full experience credit inside the requested range', () => {
    expect(experienceFit(3, 2, 5)).toBe(1)
    expect(experienceFit(3, 5, 7)).toBe(0.6)
  })

  it('scores strong React roles above weak-fit roles', () => {
    const cv = mockCvs[0]
    const excellent = computeMatch(mockProfile, cv, mockJobs[0])
    const weak = computeMatch(mockProfile, cv, mockJobs[7])

    expect(excellent.totalScore).toBeGreaterThan(80)
    expect(excellent.totalScore).toBeGreaterThan(weak.totalScore)
  })

  it('filters and sorts scored jobs by match score', () => {
    const cv = mockCvs[0]
    const scoredJobs = scoreJobs(mockProfile, cv, mockJobs, [])
    const filtered = filterAndSortJobs(scoredJobs, {
      search: 'react',
      scoreMin: 70,
      workModes: ['remote', 'hybrid'],
      jobTypes: [],
      levels: [],
      sources: [],
      datePosted: 'month',
      salaryMin: 0,
      sort: 'score',
    })

    expect(filtered.length).toBeGreaterThan(1)
    expect(filtered[0].match.totalScore).toBeGreaterThanOrEqual(filtered[1].match.totalScore)
  })
})
