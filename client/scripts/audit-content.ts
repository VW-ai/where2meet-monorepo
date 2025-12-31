#!/usr/bin/env tsx

/**
 * Content Audit Script
 *
 * Scans all pages for content metadata and identifies stale content.
 * Generates a markdown report at /docs/content/stale-content-report.md
 *
 * Usage:
 *   npm run audit:content
 *   # or
 *   tsx scripts/audit-content.ts
 */

import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CONTENT_REGISTRY, needsReview, isStale } from '../src/lib/seo/content-registry';
import type { ContentMetadata } from '../src/lib/seo/types/content';

const OUTPUT_PATH = join(process.cwd(), 'docs/content/stale-content-report.md');

interface AuditResult {
  path: string;
  metadata: ContentMetadata;
  issues: string[];
  status: 'current' | 'needs_review' | 'stale';
}

/**
 * Audit all pages in the content registry
 */
function auditAllPages(): AuditResult[] {
  const results: AuditResult[] = [];
  const today = new Date();

  for (const [path, metadata] of Object.entries(CONTENT_REGISTRY)) {
    const issues: string[] = [];
    let status: 'current' | 'needs_review' | 'stale' = 'current';

    // Check if needs review (nextReviewDate < today)
    if (needsReview(metadata)) {
      issues.push(`Review overdue (due: ${metadata.nextReviewDate})`);
      status = 'needs_review';
    }

    // Check if stale (lastModified > 6 months ago)
    if (isStale(metadata)) {
      const lastModified = new Date(metadata.lastModified);
      const monthsSinceUpdate = Math.floor(
        (today.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      issues.push(`Not updated in ${monthsSinceUpdate} months`);
      status = 'stale';
    }

    // Check if lastReviewed is different from lastModified (content reviewed but not updated)
    if (metadata.lastReviewed !== metadata.lastModified) {
      const daysSinceReview = Math.floor(
        (today.getTime() - new Date(metadata.lastReviewed).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceReview > 90) {
        issues.push(`Last reviewed ${daysSinceReview} days ago`);
      }
    }

    results.push({
      path,
      metadata,
      issues,
      status: issues.length > 0 ? status : 'current',
    });
  }

  return results;
}

/**
 * Generate markdown report
 */
function generateReport(results: AuditResult[]): string {
  const today = new Date().toISOString().split('T')[0];

  const currentPages = results.filter((r) => r.status === 'current');
  const needsReviewPages = results.filter((r) => r.status === 'needs_review');
  const stalePages = results.filter((r) => r.status === 'stale');

  let report = `# Content Audit Report\n\n`;
  report += `**Generated:** ${today}\n`;
  report += `**Total Pages:** ${results.length}\n\n`;

  // Summary
  report += `## Summary\n\n`;
  report += `| Status | Count | Percentage |\n`;
  report += `|--------|-------|------------|\n`;
  report += `| ✅ Current | ${currentPages.length} | ${Math.round((currentPages.length / results.length) * 100)}% |\n`;
  report += `| ⚠️ Needs Review | ${needsReviewPages.length} | ${Math.round((needsReviewPages.length / results.length) * 100)}% |\n`;
  report += `| 🔴 Stale | ${stalePages.length} | ${Math.round((stalePages.length / results.length) * 100)}% |\n\n`;

  // Priority Actions
  if (needsReviewPages.length > 0 || stalePages.length > 0) {
    report += `## ⚠️ Priority Actions Required\n\n`;

    if (stalePages.length > 0) {
      report += `### 🔴 Stale Pages (Immediate Action)\n\n`;
      report += `These pages haven't been updated in over 6 months:\n\n`;
      stalePages.forEach((page) => {
        report += `**${page.path}**\n`;
        report += `- Type: ${page.metadata.contentType}\n`;
        report += `- Last Modified: ${page.metadata.lastModified}\n`;
        report += `- Issues: ${page.issues.join(', ')}\n`;
        report += `- Next Review: ${page.metadata.nextReviewDate}\n\n`;
      });
    }

    if (needsReviewPages.length > 0) {
      report += `### ⚠️ Pages Needing Review\n\n`;
      report += `These pages have passed their review date:\n\n`;
      needsReviewPages.forEach((page) => {
        report += `**${page.path}**\n`;
        report += `- Type: ${page.metadata.contentType}\n`;
        report += `- Last Modified: ${page.metadata.lastModified}\n`;
        report += `- Last Reviewed: ${page.metadata.lastReviewed}\n`;
        report += `- Next Review: ${page.metadata.nextReviewDate}\n`;
        report += `- Issues: ${page.issues.join(', ')}\n\n`;
      });
    }
  }

  // Current Pages (All Good)
  if (currentPages.length > 0) {
    report += `## ✅ Current Pages\n\n`;
    report += `These pages are up to date:\n\n`;
    report += `| Page | Type | Last Modified | Next Review |\n`;
    report += `|------|------|---------------|-------------|\n`;
    currentPages.forEach((page) => {
      report += `| ${page.path} | ${page.metadata.contentType} | ${page.metadata.lastModified} | ${page.metadata.nextReviewDate} |\n`;
    });
    report += `\n`;
  }

  // Full Page Details
  report += `## Full Page Details\n\n`;
  results.forEach((page) => {
    const statusIcon =
      page.status === 'current' ? '✅' : page.status === 'needs_review' ? '⚠️' : '🔴';

    report += `### ${statusIcon} ${page.path}\n\n`;
    report += `**Content Type:** ${page.metadata.contentType}\n`;
    report += `**Update Frequency:** ${page.metadata.updateFrequency}\n`;
    report += `**Published:** ${page.metadata.publishedDate}\n`;
    report += `**Last Modified:** ${page.metadata.lastModified}\n`;
    report += `**Last Reviewed:** ${page.metadata.lastReviewed}\n`;
    report += `**Next Review:** ${page.metadata.nextReviewDate}\n`;
    report += `**Status:** ${page.metadata.status}\n`;

    if (page.issues.length > 0) {
      report += `**Issues:** ${page.issues.join(', ')}\n`;
    }

    report += `\n`;
  });

  // Recommendations
  report += `## Recommendations\n\n`;
  report += `### Review Schedule\n\n`;
  report += `Based on content type, here's the recommended review frequency:\n\n`;
  report += `- **Landing Pages** (homepage, /scenarios): Monthly review\n`;
  report += `- **Feature Pages** (/how-it-works): Quarterly review\n`;
  report += `- **FAQ**: Monthly review (add new questions, refine answers)\n`;
  report += `- **Scenario Pages**: Quarterly review (refresh examples, seasonal relevance)\n`;
  report += `- **Contact**: Yearly review (verify contact info)\n\n`;

  report += `### Action Items\n\n`;
  if (stalePages.length > 0) {
    report += `1. **URGENT:** Update ${stalePages.length} stale page(s)\n`;
  }
  if (needsReviewPages.length > 0) {
    report += `${stalePages.length > 0 ? '2' : '1'}. Review ${needsReviewPages.length} page(s) that are past their review date\n`;
  }
  if (currentPages.length === results.length) {
    report += `✅ All pages are current. Next audit recommended in 30 days.\n`;
  }

  return report;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Starting content audit...\n');

  // Audit all pages
  const results = auditAllPages();

  console.log(`📊 Audited ${results.length} pages\n`);

  // Generate report
  const report = generateReport(results);

  // Write report to file
  const outputDir = join(process.cwd(), 'docs/content');
  if (!existsSync(outputDir)) {
    console.error(`❌ Output directory does not exist: ${outputDir}`);
    console.error('Please create the directory first.');
    process.exit(1);
  }

  writeFileSync(OUTPUT_PATH, report, 'utf-8');
  console.log(`✅ Report generated: ${OUTPUT_PATH}\n`);

  // Print summary to console
  const staleCount = results.filter((r) => r.status === 'stale').length;
  const needsReviewCount = results.filter((r) => r.status === 'needs_review').length;

  if (staleCount > 0 || needsReviewCount > 0) {
    console.log('⚠️  Issues found:');
    if (staleCount > 0) {
      console.log(`   🔴 ${staleCount} stale page(s) - URGENT`);
    }
    if (needsReviewCount > 0) {
      console.log(`   ⚠️  ${needsReviewCount} page(s) need review`);
    }
    console.log(`\nSee full report at: ${OUTPUT_PATH}\n`);
    process.exit(1); // Exit with error code if issues found
  } else {
    console.log('✅ All pages are current!\n');
    process.exit(0);
  }
}

main();
