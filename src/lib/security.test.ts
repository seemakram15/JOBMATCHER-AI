import { describe, expect, it } from 'vitest'
import { sanitiseJob, sanitiseParsedCv, sanitiseUrl } from './security'
import type { Job, ParsedCvPayload } from '../types'

describe('security sanitizers', () => {
  it('removes executable content from parsed CV payloads', () => {
    const payload: ParsedCvPayload = {
      label: '<img src=x onerror=alert(1)>Frontend CV',
      filename: '../cv<script>alert(1)</script>.pdf',
      text: 'Hello<script>alert(1)</script>',
      totalYearsExperience: 100,
      skills: [
        {
          skillName: '<svg onload=alert(1)>React',
          skillCanonical: 'React',
          skillType: 'framework',
          yearsUsed: 99,
          skillRank: 150,
          confidence: 'high',
        },
      ],
      experience: [],
      education: ['<b onclick=alert(1)>BS CS</b>'],
      certifications: [],
      warnings: [],
    }

    const safe = sanitiseParsedCv(payload)

    expect(safe.label).not.toContain('<')
    expect(safe.text).not.toContain('script')
    expect(safe.totalYearsExperience).toBe(60)
    expect(safe.skills[0].yearsUsed).toBe(60)
    expect(safe.skills[0].skillRank).toBe(100)
    expect(safe.education[0]).toBe('BS CS')
  })

  it('blocks dangerous URLs', () => {
    expect(sanitiseUrl('javascript:alert(1)', 'https://example.com')).toBe('https://example.com')
    expect(sanitiseUrl('https://example.com/jobs')).toBe('https://example.com/jobs')
  })

  it('converts untrusted job HTML into safe paragraphs', () => {
    const job: Job = {
      id: '3f87e98e-6698-5c2d-8ef7-b2a7ce58b7ab',
      title: '<img onerror=alert(1)>Engineer',
      company: 'Company',
      location: 'Remote',
      country: 'Remote',
      city: 'Remote',
      isRemote: true,
      workMode: 'remote',
      description: 'Build things',
      descriptionHtml: '<script>alert(1)</script><p onclick=alert(1)>Build</p>',
      salaryCurrency: 'USD',
      jobType: 'full_time',
      experienceMin: 70,
      experienceMax: 80,
      level: 'senior',
      skillsRequired: [{ skill: '<b>React</b>', required: true, weight: 99 }],
      applyUrl: 'data:text/html,boom',
      sourcePlatform: 'Remotive',
      postedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    }

    const safe = sanitiseJob(job)

    expect(safe.title).toBe('Engineer')
    expect(safe.descriptionHtml).not.toContain('script')
    expect(safe.descriptionHtml).not.toContain('onclick')
    expect(safe.experienceMin).toBe(60)
    expect(safe.applyUrl).toMatch(/^https:\/\//)
    expect(safe.skillsRequired[0].skill).toBe('React')
    expect(safe.skillsRequired[0].weight).toBe(5)
  })
})
