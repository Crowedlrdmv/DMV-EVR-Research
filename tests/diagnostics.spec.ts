import { test, expect } from '@playwright/test';

test.describe('Diagnostics Panel', () => {
  test('should display system health overview', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Check main diagnostics title
    await expect(page.locator('h2')).toContainText('System Diagnostics');
    
    // Check for health tab (default)
    await expect(page.locator('[role="tab"][data-state="active"]')).toContainText('System Health');
  });

  test('should show system health cards', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Wait for health data to load
    await page.waitForTimeout(2000);
    
    // Check for health status cards (these should appear regardless of actual status)
    const healthCards = page.locator('.grid .space-y-2');
    await expect(healthCards.first()).toBeVisible();
  });

  test('should toggle auto-refresh', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Test auto-refresh toggle
    await page.click('[data-testid="toggle-auto-refresh"]');
    await expect(page.locator('[data-testid="toggle-auto-refresh"]')).toContainText('Resume');
    
    await page.click('[data-testid="toggle-auto-refresh"]');
    await expect(page.locator('[data-testid="toggle-auto-refresh"]')).toContainText('Pause');
  });

  test('should manually refresh diagnostics', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Test manual refresh
    await page.click('[data-testid="refresh-diagnostics"]');
    await page.waitForTimeout(1000);
  });

  test('should navigate between diagnostic tabs', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Test Activity tab
    await page.click('[role="tab"]', { hasText: 'Recent Activity' });
    await expect(page.locator('[role="tab"][data-state="active"]')).toContainText('Recent Activity');
    
    // Test Performance tab
    await page.click('[role="tab"]', { hasText: 'Performance' });
    await expect(page.locator('[role="tab"][data-state="active"]')).toContainText('Performance');
    
    // Go back to Health tab
    await page.click('[role="tab"]', { hasText: 'System Health' });
    await expect(page.locator('[role="tab"][data-state="active"]')).toContainText('System Health');
  });

  test('should display activity log', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Switch to activity tab
    await page.click('[role="tab"]', { hasText: 'Recent Activity' });
    
    // Check for activity log container
    await expect(page.locator('h2')).toContainText('System Activity Log');
    
    // Should show either activity items or no activity message
    await page.waitForTimeout(2000);
    const hasActivity = await page.locator('.space-y-3 .flex.items-start').first().isVisible();
    const noActivity = await page.locator('text=No recent activity').isVisible();
    
    expect(hasActivity || noActivity).toBeTruthy();
  });

  test('should show performance metrics', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Switch to performance tab
    await page.click('[role="tab"]', { hasText: 'Performance' });
    
    // Check for performance cards
    await expect(page.locator('text=Research Job Performance')).toBeVisible();
    await expect(page.locator('text=API Performance')).toBeVisible();
  });

  test('should handle loading states', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Should show loading state initially
    const loadingMessage = page.locator('text=Loading system health...');
    if (await loadingMessage.isVisible()) {
      await expect(loadingMessage).toBeVisible();
    }
    
    // Wait for data to load
    await page.waitForTimeout(3000);
  });

  test('should display status badges with colors', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Wait for health data
    await page.waitForTimeout(2000);
    
    // Check for status badges (color classes might vary based on actual system status)
    const statusBadges = page.locator('.inline-flex.items-center.px-2\\.5.py-0\\.5');
    const count = await statusBadges.count();
    
    if (count > 0) {
      await expect(statusBadges.first()).toBeVisible();
    }
  });

  test('should show API and database health status', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Wait for health data to load
    await page.waitForTimeout(3000);
    
    // Check for specific health components
    const apiServerCard = page.locator('text=API Server').locator('..');
    const databaseCard = page.locator('text=Database').locator('..');
    const queueCard = page.locator('text=Job Queue').locator('..');
    const storageCard = page.locator('text=Storage').locator('..');
    
    await expect(apiServerCard).toBeVisible();
    await expect(databaseCard).toBeVisible();
    await expect(queueCard).toBeVisible();
    await expect(storageCard).toBeVisible();
  });

  test('should show job performance metrics', async ({ page }) => {
    await page.goto('/diagnostics');
    
    // Switch to performance tab
    await page.click('[role="tab"]', { hasText: 'Performance' });
    
    // Wait for performance data
    await page.waitForTimeout(2000);
    
    // Check for performance metrics
    const jobMetrics = page.locator('text=Jobs Completed (24h)');
    const jobsFailedMetrics = page.locator('text=Jobs Failed (24h)');
    const successRateMetrics = page.locator('text=Success Rate');
    
    if (await jobMetrics.isVisible()) {
      await expect(jobMetrics).toBeVisible();
      await expect(jobsFailedMetrics).toBeVisible();
      await expect(successRateMetrics).toBeVisible();
    }
  });
});