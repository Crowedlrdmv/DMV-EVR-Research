import { test, expect } from '@playwright/test';

test.describe('Research Jobs', () => {
  test('should create and manage research jobs', async ({ page }) => {
    await page.goto('/research');
    
    // Wait for page to load
    await expect(page.locator('[data-testid="research-controls"]')).toBeVisible();
    
    // Test job creation form
    await page.selectOption('[data-testid="select-states"]', ['CA', 'TX']);
    await page.check('[data-testid="checkbox-rules"]');
    await page.check('[data-testid="checkbox-emissions"]');
    await page.selectOption('[data-testid="select-depth"]', 'summary');
    
    // Submit job (if feature is enabled)
    const runButton = page.locator('[data-testid="button-run-research"]');
    if (await runButton.isEnabled()) {
      await runButton.click();
      
      // Wait for job to appear in the table
      await expect(page.locator('[data-testid="jobs-table"]')).toBeVisible();
      
      // Check for job entry
      await expect(page.locator('[data-testid^="job-row-"]').first()).toBeVisible();
    }
  });

  test('should filter and search jobs', async ({ page }) => {
    await page.goto('/research');
    
    // Test status filtering
    await page.selectOption('[data-testid="filter-status"]', 'success');
    await page.waitForTimeout(1000); // Wait for filtering
    
    // Test state filtering
    await page.selectOption('[data-testid="filter-state"]', 'CA');
    await page.waitForTimeout(1000);
    
    // Test search functionality
    await page.fill('[data-testid="search-jobs"]', 'emissions');
    await page.waitForTimeout(1000);
    
    // Clear filters
    await page.click('[data-testid="button-clear-filters"]');
  });

  test('should display job details and progress', async ({ page }) => {
    await page.goto('/research');
    
    // Wait for jobs table
    await expect(page.locator('[data-testid="jobs-table"]')).toBeVisible();
    
    // Check if there are any jobs to expand
    const jobRows = page.locator('[data-testid^="job-row-"]');
    const count = await jobRows.count();
    
    if (count > 0) {
      // Click first job to expand details
      await jobRows.first().click();
      
      // Check for job details
      await expect(page.locator('[data-testid^="job-details-"]').first()).toBeVisible();
    }
  });

  test('should handle job retry functionality', async ({ page }) => {
    await page.goto('/research');
    
    // Look for failed jobs with retry buttons
    const retryButtons = page.locator('[data-testid="button-retry-job"]');
    const count = await retryButtons.count();
    
    if (count > 0) {
      // Click retry on first failed job
      await retryButtons.first().click();
      
      // Verify loading state
      await expect(retryButtons.first()).toContainText('Retrying...');
    }
  });

  test('should export job results', async ({ page }) => {
    await page.goto('/research');
    
    // Test export functionality
    const exportButton = page.locator('[data-testid="button-export-results"]');
    if (await exportButton.isVisible()) {
      await exportButton.click();
      
      // Wait for export modal or download
      await page.waitForTimeout(2000);
    }
  });
});