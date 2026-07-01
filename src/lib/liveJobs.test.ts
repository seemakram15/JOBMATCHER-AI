import { describe, expect, it } from 'vitest'
import { explainLiveJobRelevance, filterRelevantJobsForSearch } from './liveJobs'
import type { Job } from '../types'

const now = new Date().toISOString()
let jobIndex = 0

function job(overrides: Partial<Job>): Job {
  return {
    id: overrides.id || `job-${jobIndex += 1}`,
    title: overrides.title || 'Untitled role',
    company: overrides.company || 'Example Co',
    companyLogo: 'EC',
    location: 'Remote',
    country: 'Remote',
    city: 'Remote',
    isRemote: true,
    workMode: 'remote',
    description: overrides.description || '',
    descriptionHtml: overrides.descriptionHtml || '<p></p>',
    salaryCurrency: 'USD',
    jobType: 'full_time',
    level: 'mid',
    skillsRequired: overrides.skillsRequired || [],
    applyUrl: 'https://example.com/apply',
    sourcePlatform: 'Test',
    postedAt: now,
    fetchedAt: now,
    ...overrides,
  }
}

describe('live job relevance filtering', () => {
  const cvSkills = [
    'Agile',
    'AWS',
    'CI/CD',
    'Communication',
    'CSS',
    'Data Analysis',
    'Git',
    'GraphQL',
    'HTML',
    'JavaScript',
    'MySQL',
    'React',
    'Redis',
    'REST APIs',
    'Ruby on Rails',
    'SQL',
  ]

  it('keeps software roles and rejects admin/data-entry matches from broad skills', () => {
    const results = filterRelevantJobsForSearch(
      [
        job({
          title: 'Senior Frontend Engineer',
          description: 'Build customer dashboards with React, JavaScript, CSS, GraphQL, and REST APIs.',
          skillsRequired: [
            { skill: 'React', required: true, weight: 1 },
            { skill: 'JavaScript', required: true, weight: 1 },
          ],
        }),
        job({
          title: 'Software Engineer',
          description: 'Ruby on Rails, MySQL, Redis, SQL, and REST API product work.',
          skillsRequired: [
            { skill: 'Ruby on Rails', required: true, weight: 1 },
            { skill: 'SQL', required: true, weight: 1 },
          ],
        }),
        job({
          title: 'Data Entry Specialist Assistant Administrator',
          description: 'Administrative research panel work using spreadsheets and data entry.',
          skillsRequired: [{ skill: 'Data Analysis', required: true, weight: 1 }],
        }),
        job({
          title: 'Site Reliability Engineer Role',
          description: 'Own infrastructure, incident response, Terraform, Kubernetes, and platform reliability.',
          skillsRequired: [
            { skill: 'AWS', required: true, weight: 1 },
            { skill: 'Communication', required: true, weight: 0.5 },
          ],
        }),
      ],
      {
        query: 'Software Engineer',
        skills: cvSkills,
        avoidKeywords: ['Data Entry', 'Assistant', 'Administrator'],
        preferredCountries: ['Remote'],
        preferredCities: ['Remote'],
        remotePreference: 'remote',
        experienceYears: 5,
        limit: 10,
      },
    )

    expect(results.map((result) => result.title)).toEqual(['Senior Frontend Engineer', 'Software Engineer'])
  })

  it('uses profile preferences to keep location and avoid-keyword filters strict', () => {
    const results = filterRelevantJobsForSearch(
      [
        job({
          title: 'React Frontend Engineer',
          description: 'Frontend product work with React, TypeScript, and REST APIs.',
          skillsRequired: [
            { skill: 'React', required: true, weight: 1 },
            { skill: 'TypeScript', required: true, weight: 1 },
          ],
          location: 'Remote',
          workMode: 'remote',
          isRemote: true,
        }),
        job({
          title: 'React Sales Engineer',
          description: 'Sales demos, account handling, and light React examples.',
          skillsRequired: [{ skill: 'React', required: true, weight: 1 }],
        }),
        job({
          title: 'Frontend Engineer',
          location: 'Berlin, Germany',
          country: 'Germany',
          city: 'Berlin',
          isRemote: false,
          workMode: 'onsite',
          description: 'React and TypeScript platform work from Berlin office.',
          skillsRequired: [
            { skill: 'React', required: true, weight: 1 },
            { skill: 'TypeScript', required: true, weight: 1 },
          ],
        }),
      ],
      {
        query: 'Frontend Engineer',
        skills: ['React', 'TypeScript', 'REST APIs'],
        mustHaveSkills: ['React', 'TypeScript'],
        avoidKeywords: ['Sales'],
        preferredCountries: ['Remote'],
        preferredCities: ['Remote'],
        remotePreference: 'remote',
        experienceYears: 4,
        limit: 10,
      },
    )

    expect(results.map((result) => result.title)).toEqual(['React Frontend Engineer'])
  })

  it('builds source queries from the main role, must-have skills, and ranked CV Hub skills', () => {
    const explanation = explainLiveJobRelevance(
      job({
        title: 'Frontend Platform Engineer',
        description: 'React, TypeScript, GraphQL, REST APIs, and Node.js product work.',
        skillsRequired: [
          { skill: 'React', required: true, weight: 1 },
          { skill: 'TypeScript', required: true, weight: 1 },
          { skill: 'GraphQL', required: true, weight: 1 },
        ],
      }),
      {
        query: 'Frontend Engineer',
        targetRoles: ['Frontend Engineer'],
        mustHaveSkills: ['React'],
        skills: ['React', 'TypeScript', 'GraphQL', 'REST APIs', 'Node.js'],
        preferredCountries: ['Remote'],
        preferredCities: ['Remote'],
        remotePreference: 'remote',
        experienceYears: 4,
        limit: 10,
      },
    )

    expect(explanation.search.sourceQuery).toContain('Frontend Engineer')
    expect(explanation.search.sourceQuery).toContain('React')
    expect(explanation.search.sourceQuery).toContain('TypeScript')
    expect(explanation.search.sourceQuery).toContain('GraphQL')
    expect(explanation.relevance.accept).toBe(true)
  })

  it('keeps job titles restricted while allowing a 7-year user to see 4-7 year Rails roles', () => {
    const results = filterRelevantJobsForSearch(
      [
        job({
          title: 'Ruby on Rails Developer',
          description: 'Build marketplace products with Ruby on Rails, PostgreSQL, Redis, and REST APIs. 4+ years experience.',
          experienceMin: 4,
          experienceMax: 6,
          level: 'senior',
          skillsRequired: [
            { skill: 'Ruby on Rails', required: true, weight: 1 },
            { skill: 'PostgreSQL', required: true, weight: 1 },
          ],
        }),
        job({
          title: 'Senior Ruby Engineer',
          description: 'Rails monolith modernization with MySQL and background jobs. 7 years experience preferred.',
          experienceMin: 7,
          experienceMax: 9,
          level: 'senior',
          skillsRequired: [
            { skill: 'Ruby', required: true, weight: 1 },
            { skill: 'MySQL', required: true, weight: 1 },
          ],
        }),
        job({
          title: 'Junior Ruby on Rails Developer',
          description: 'Entry-level Rails role for graduates.',
          experienceMin: 0,
          experienceMax: 2,
          level: 'entry',
          skillsRequired: [{ skill: 'Ruby on Rails', required: true, weight: 1 }],
        }),
        job({
          title: 'Site Reliability Engineer',
          description: 'AWS, Kubernetes, Terraform, and incident response for Rails systems.',
          experienceMin: 5,
          experienceMax: 8,
          level: 'senior',
          skillsRequired: [{ skill: 'AWS', required: true, weight: 1 }],
        }),
        job({
          title: 'Ruby on Rails Architect',
          description: 'Platform architecture role requiring 8+ years with Rails.',
          experienceMin: 8,
          experienceMax: 12,
          level: 'lead',
          skillsRequired: [{ skill: 'Ruby on Rails', required: true, weight: 1 }],
        }),
      ],
      {
        query: 'Ruby on Rails careers',
        skills: ['Ruby on Rails', 'Ruby', 'PostgreSQL', 'MySQL', 'Redis', 'REST APIs'],
        mustHaveSkills: ['Ruby on Rails'],
        preferredCountries: ['Remote'],
        preferredCities: ['Remote'],
        remotePreference: 'remote',
        experienceYears: 7,
        limit: 10,
      },
    )

    expect(results.map((result) => result.title)).toEqual([
      'Ruby on Rails Developer',
      'Senior Ruby Engineer',
    ])
  })

  it('allows generic technical titles when the JD strongly matches the role skills', () => {
    const goodFit = explainLiveJobRelevance(
      job({
        title: 'Full Stack Software Engineer',
        description:
          'Own product features across a Ruby on Rails backend, React frontend, PostgreSQL, Redis, and REST APIs. 5+ years experience.',
        experienceMin: 5,
        experienceMax: 7,
        level: 'senior',
        skillsRequired: [
          { skill: 'Ruby on Rails', required: true, weight: 1 },
          { skill: 'React', required: true, weight: 1 },
          { skill: 'PostgreSQL', required: true, weight: 1 },
        ],
      }),
      {
        query: 'Ruby on Rails careers',
        skills: ['Ruby on Rails', 'Ruby', 'React', 'PostgreSQL', 'Redis', 'REST APIs'],
        mustHaveSkills: ['Ruby on Rails'],
        preferredCountries: ['Remote'],
        preferredCities: ['Remote'],
        remotePreference: 'remote',
        experienceYears: 7,
        limit: 10,
      },
    )

    const badFit = explainLiveJobRelevance(
      job({
        title: 'Data Entry Specialist',
        description: 'Spreadsheet research and administrative data cleanup with light software exposure.',
        skillsRequired: [{ skill: 'Data Analysis', required: true, weight: 1 }],
      }),
      {
        query: 'Ruby on Rails careers',
        skills: ['Ruby on Rails', 'Ruby', 'React', 'PostgreSQL', 'Redis', 'REST APIs'],
        mustHaveSkills: ['Ruby on Rails'],
        preferredCountries: ['Remote'],
        preferredCities: ['Remote'],
        remotePreference: 'remote',
        experienceYears: 7,
        limit: 10,
      },
    )

    expect(goodFit.relevance.accept).toBe(true)
    expect(badFit.relevance.accept).toBe(false)
  })
})
