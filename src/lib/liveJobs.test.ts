import { describe, expect, it } from 'vitest'
import { filterRelevantJobsForSearch } from './liveJobs'
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
        experienceYears: 5,
        limit: 10,
      },
    )

    expect(results.map((result) => result.title)).toEqual(['Senior Frontend Engineer', 'Software Engineer'])
  })
})
