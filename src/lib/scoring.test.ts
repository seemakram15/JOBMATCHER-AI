import { describe, expect, it } from 'vitest'
import { computeMatch, experienceFit, filterAndSortJobs, normaliseSkill, scoreJobs } from './scoring'
import type { CvProfile, Job, UserProfile } from '../types'

const sampleProfile: UserProfile = {
  id: 'user-test',
  email: 'test@example.com',
  name: 'Test User',
  role: 'job_seeker',
  headline: '',
  location: 'Remote',
  targetRole: 'Senior Frontend Engineer',
  targetRoles: ['Senior Frontend Engineer'],
  mustHaveSkills: ['React', 'TypeScript'],
  avoidKeywords: ['Data Entry'],
  preferredCountries: ['Remote'],
  preferredCities: ['Remote'],
  remotePreference: 'remote',
  preferredRemote: true,
  minimumSalary: 0,
  experienceYears: 5,
  goodJobExamples: ['Senior Frontend Engineer'],
  badJobExamples: ['Data Entry Assistant'],
  profileCompletedAt: new Date().toISOString(),
  salaryMin: 0,
  salaryMax: 0,
  currency: 'USD',
  activeCvId: 'cv-test',
}

const sampleCv: CvProfile = {
  id: 'cv-test',
  label: 'Test CV',
  filename: 'test.txt',
  version: 1,
  isActive: true,
  parseStatus: 'done',
  parsedAt: new Date().toISOString(),
  totalYearsExperience: 5,
  skills: [
    { skillName: 'React', skillCanonical: 'React', skillType: 'framework', yearsUsed: 5, skillRank: 92, confidence: 'high' },
    { skillName: 'TypeScript', skillCanonical: 'TypeScript', skillType: 'technical', yearsUsed: 4, skillRank: 88, confidence: 'high' },
    { skillName: 'Node.js', skillCanonical: 'Node.js', skillType: 'technical', yearsUsed: 3, skillRank: 82, confidence: 'high' },
  ],
  experience: [],
}

const sampleJobs: Job[] = [
  {
    id: '3f87e98e-6698-5c2d-8ef7-b2a7ce58b7ab',
    title: 'Senior Frontend Engineer',
    company: 'Live Source Co',
    location: 'Remote',
    country: 'Remote',
    city: 'Remote',
    isRemote: true,
    workMode: 'remote',
    description: 'Build product features with React, TypeScript, and Node.js.',
    descriptionHtml: '<p>Build product features with React, TypeScript, and Node.js.</p>',
    salaryCurrency: 'USD',
    jobType: 'full_time',
    experienceMin: 4,
    experienceMax: 7,
    level: 'senior',
    skillsRequired: [
      { skill: 'React', required: true, weight: 1 },
      { skill: 'TypeScript', required: true, weight: 1 },
      { skill: 'Node.js', required: false, weight: 0.5 },
    ],
    applyUrl: 'https://example.com/apply',
    sourcePlatform: 'Test source',
    postedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  },
  {
    id: '74f76865-0659-554f-8a4e-bc7054df4335',
    title: 'React Product Engineer',
    company: 'Remote Team',
    location: 'Remote',
    country: 'Remote',
    city: 'Remote',
    isRemote: true,
    workMode: 'remote',
    description: 'React and TypeScript product work.',
    descriptionHtml: '<p>React and TypeScript product work.</p>',
    salaryCurrency: 'USD',
    jobType: 'contract',
    experienceMin: 3,
    experienceMax: 6,
    level: 'senior',
    skillsRequired: [
      { skill: 'React', required: true, weight: 1 },
      { skill: 'TypeScript', required: true, weight: 1 },
    ],
    applyUrl: 'https://example.com/react',
    sourcePlatform: 'Test source',
    postedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'f9c191a1-7678-5301-98f5-f9b20c9d6400',
    title: 'Backend Data Engineer',
    company: 'Data Team',
    location: 'Onsite',
    country: 'US',
    city: 'Austin',
    isRemote: false,
    workMode: 'onsite',
    description: 'Python and data pipelines.',
    descriptionHtml: '<p>Python and data pipelines.</p>',
    salaryCurrency: 'USD',
    jobType: 'full_time',
    experienceMin: 7,
    experienceMax: 10,
    level: 'senior',
    skillsRequired: [
      { skill: 'Python', required: true, weight: 1 },
      { skill: 'Spark', required: true, weight: 1 },
    ],
    applyUrl: 'https://example.com/data',
    sourcePlatform: 'Test source',
    postedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  },
]

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
    const excellent = computeMatch(sampleProfile, sampleCv, sampleJobs[0])
    const weak = computeMatch(sampleProfile, sampleCv, sampleJobs[2])

    expect(excellent.totalScore).toBeGreaterThan(80)
    expect(excellent.totalScore).toBeGreaterThan(weak.totalScore)
  })

  it('filters and sorts scored jobs by match score', () => {
    const scoredJobs = scoreJobs(sampleProfile, sampleCv, sampleJobs, [])
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
