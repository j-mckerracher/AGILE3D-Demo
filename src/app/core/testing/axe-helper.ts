/**
 * AGILE3D Axe Accessibility Testing Helper
 *
 * Utility for running axe-core accessibility tests in Jasmine tests.
 * Ensures WCAG 2.2 AA compliance.
 *
 * PRD References:
 * - NFR-3.5: WCAG 2.2 AA compliance
 */

import axe from 'axe-core';

/**
 * Configuration for axe tests.
 */
export interface AxeTestConfig {
  /**
   * WCAG level to test against (default: 'AA')
   */
  level?: 'A' | 'AA' | 'AAA';

  /**
   * Additional rules to enable/disable
   */
  rules?: Record<string, { enabled: boolean }>;

  /**
   * Selectors to exclude from testing
   */
  exclude?: string[];
}

/**
 * Default axe configuration for WCAG 2.2 AA compliance.
 */
const DEFAULT_AXE_CONFIG: axe.RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag22aa'],
  },
  rules: {
    // Ensure color contrast meets WCAG AA (4.5:1 for normal text)
    'color-contrast': { enabled: true },
    // Ensure all interactive elements are keyboard accessible
    keyboard: { enabled: true },
    // Ensure focus indicators are visible
    'focus-order': { enabled: true },
    // Ensure ARIA attributes are valid
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    // Ensure landmarks are properly used
    region: { enabled: true },
    // Ensure headings are in logical order
    'heading-order': { enabled: true },
  },
};

/**
 * Run axe accessibility tests on an element.
 *
 * @param element - HTML element to test
 * @param config - Optional configuration
 * @returns Promise resolving to axe results
 */
export async function runAxeTest(
  element: HTMLElement,
  config?: AxeTestConfig
): Promise<axe.AxeResults> {
  const axeConfig: axe.RunOptions = {
    ...DEFAULT_AXE_CONFIG,
    ...config?.rules,
  };

  return await axe.run(element, axeConfig);
}

/**
 * Assert that an element has no accessibility violations.
 * Uses Jasmine expectations.
 *
 * @param element - HTML element to test
 * @param config - Optional configuration
 */
export async function expectNoA11yViolations(
  element: HTMLElement,
  config?: AxeTestConfig
): Promise<void> {
  const results = await runAxeTest(element, config);

  const violations = results.violations;

  if (violations.length > 0) {
    const violationMessages = violations.map((violation) => {
      const nodes = violation.nodes
        .map(
          (node) =>
            `    - ${node.html}\n      ${node.failureSummary}\n      Target: ${node.target.join(', ')}`
        )
        .join('\n');

      return `  ${violation.id}: ${violation.description}\n    Impact: ${violation.impact}\n    Help: ${violation.helpUrl}\n${nodes}`;
    });

    const message = `Expected no accessibility violations but found ${violations.length}:\n\n${violationMessages.join('\n\n')}`;

    throw new Error(message);
  }
}

/**
 * Assert that an element has no critical or serious accessibility violations.
 * Allows minor and moderate violations for gradual improvement.
 *
 * @param element - HTML element to test
 * @param config - Optional configuration
 */
export async function expectNoCriticalA11yViolations(
  element: HTMLElement,
  config?: AxeTestConfig
): Promise<void> {
  const results = await runAxeTest(element, config);

  const criticalViolations = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  if (criticalViolations.length > 0) {
    const violationMessages = criticalViolations.map((violation) => {
      const nodes = violation.nodes
        .map(
          (node) =>
            `    - ${node.html}\n      ${node.failureSummary}\n      Target: ${node.target.join(', ')}`
        )
        .join('\n');

      return `  ${violation.id}: ${violation.description}\n    Impact: ${violation.impact}\n    Help: ${violation.helpUrl}\n${nodes}`;
    });

    const message = `Expected no critical/serious accessibility violations but found ${criticalViolations.length}:\n\n${violationMessages.join('\n\n')}`;

    throw new Error(message);
  }
}

/**
 * Get a summary of accessibility test results.
 *
 * @param results - Axe test results
 * @returns Human-readable summary
 */
export function getA11ySummary(results: axe.AxeResults): string {
  const { violations, passes, incomplete } = results;

  const summary = [
    `Accessibility Test Summary:`,
    `  Passes: ${passes.length}`,
    `  Violations: ${violations.length}`,
    `  Incomplete: ${incomplete.length}`,
  ];

  if (violations.length > 0) {
    const bySeverity = violations.reduce(
      (acc, v) => {
        acc[v.impact || 'unknown'] = (acc[v.impact || 'unknown'] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    summary.push(`  By Severity:`);
    Object.entries(bySeverity).forEach(([severity, count]) => {
      summary.push(`    ${severity}: ${count}`);
    });
  }

  return summary.join('\n');
}
