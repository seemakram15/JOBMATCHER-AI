import { describe, expect, it } from 'vitest'
import { parseCvText } from './cvParser'

describe('CV parser', () => {
  it('extracts skills, dated experience, education, and certifications from CV text', () => {
    const parsed = parseCvText(
      `
      Sara Khan
      Senior Frontend Engineer with 5+ years experience

      Senior Frontend Engineer - Nimbus Labs
      Jan 2021 - Present
      Built React, TypeScript, Node.js, PostgreSQL and Tailwind products.

      React Developer at OrbitWorks
      May 2019 - Dec 2020
      Worked with REST APIs, Vite, GitHub Actions and Jest.

      Bachelor of Science in Computer Science, Karachi University
      AWS Certified Cloud Practitioner
      `,
      'sara-cv.pdf',
    )

    expect(parsed.skills.map((skill) => skill.skillName)).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind', 'REST APIs']),
    )
    expect(parsed.totalYearsExperience).toBeGreaterThanOrEqual(5)
    expect(parsed.experience.length).toBeGreaterThanOrEqual(2)
    expect(parsed.education[0]).toContain('Bachelor')
    expect(parsed.certifications[0]).toContain('Certified')
  })

  it('warns when extracted text is probably too short', () => {
    const parsed = parseCvText('React TypeScript', 'short.txt')

    expect(parsed.warnings[0]).toContain('short')
  })

  it('reports whole years and does not double count overlapping roles', () => {
    const parsed = parseCvText(
      `
      Waseem Akram
      Frontend Engineer

      Senior Frontend Engineer - Nimbus Labs
      Jan 2020 - Present
      Built React and TypeScript dashboards.

      React Consultant - OrbitWorks
      Jan 2021 - Dec 2021
      Delivered Node.js and PostgreSQL integrations.

      Bachelor of Computer Science
      `,
      'overlap-cv.pdf',
    )

    expect(Number.isInteger(parsed.totalYearsExperience)).toBe(true)
    expect(parsed.totalYearsExperience).toBeGreaterThanOrEqual(6)
    expect(parsed.totalYearsExperience).toBeLessThanOrEqual(7)
  })
})
