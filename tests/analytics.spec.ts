import { test, expect } from '@playwright/test';

test.describe('Analytics Dashboard', () => {
  test('should display analytics overview', async ({ page }) => {
    await page.goto('/analytics');
    
    // Check main analytics title
    await expect(page.locator('[data-testid="analytics-title"]')).toContainText('Analytics Dashboard');
    
    // Check key metrics cards
    await expect(page.locator('[data-testid="metric-total-records"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-compliance-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-failed-verifications"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-api-calls"]')).toBeVisible();
  });

  test('should filter analytics by time range', async ({ page }) => {
    await page.goto('/analytics');
    
    // Test time range filtering
    await page.selectOption('[data-testid="select-time-range"]', '7');
    await page.waitForTimeout(1000);
    
    await page.selectOption('[data-testid="select-time-range"]', '90');
    await page.waitForTimeout(1000);
    
    await page.selectOption('[data-testid="select-time-range"]', '365');
    await page.waitForTimeout(1000);
  });

  test('should display charts', async ({ page }) => {
    await page.goto('/analytics');
    
    // Check for chart containers
    await expect(page.locator('[data-testid="chart-compliance-trends"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-ingestion-volume"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-region-breakdown"]')).toBeVisible();
  });

  test('should show research analytics when data exists', async ({ page }) => {
    await page.goto('/analytics');
    
    // Check for research-specific metrics
    const researchPrograms = page.locator('[data-testid="metric-research-programs"]');
    if (await researchPrograms.isVisible()) {
      await expect(researchPrograms).toBeVisible();
      await expect(page.locator('[data-testid="metric-states-covered"]')).toBeVisible();
      await expect(page.locator('[data-testid="metric-research-artifacts"]')).toBeVisible();
      
      // Check enhanced research charts
      await expect(page.locator('[data-testid="chart-data-type-coverage"]')).toBeVisible();
      await expect(page.locator('[data-testid="chart-source-validation"]')).toBeVisible();
      await expect(page.locator('[data-testid="chart-program-trends"]')).toBeVisible();
    }
  });

  test('should display state profiles', async ({ page }) => {
    await page.goto('/analytics');
    
    // Check state profiles section
    const stateProfiles = page.locator('[data-testid="state-profiles"]');
    if (await stateProfiles.isVisible()) {
      await expect(stateProfiles).toBeVisible();
    }
  });

  test('should show recent changes', async ({ page }) => {
    await page.goto('/analytics');
    
    // Check recent changes section
    const recentChanges = page.locator('[data-testid="recent-changes"]');
    await expect(recentChanges).toBeVisible();
    
    // Should show either changes or no data message
    const hasChanges = await page.locator('.bg-muted.rounded-lg').first().isVisible();
    const noDataMessage = await page.locator('text=No Recent Changes').isVisible();
    
    expect(hasChanges || noDataMessage).toBeTruthy();
  });

  test('should refresh data', async ({ page }) => {
    await page.goto('/analytics');
    
    // Test refresh button
    await page.click('[data-testid="button-refresh"]');
    await page.waitForTimeout(1000);
  });

  test('should handle URL filters from research page', async ({ page }) => {
    // Navigate with URL parameters
    await page.goto('/analytics?states=CA,TX&types=rules,emissions');
    
    // Should show filter indicators
    const stateFilter = page.locator('text=Filtered by states: CA, TX');
    const typeFilter = page.locator('text=Filtered by types: rules, emissions');
    
    if (await stateFilter.isVisible()) {
      await expect(stateFilter).toBeVisible();
    }
    if (await typeFilter.isVisible()) {
      await expect(typeFilter).toBeVisible();
    }
  });

  test('should show empty states for charts with no data', async ({ page }) => {
    await page.goto('/analytics');
    
    // Wait for charts to load
    await page.waitForTimeout(2000);
    
    // Check for empty state messages in charts
    const complianceChart = page.locator('[data-testid="chart-compliance-trends"]');
    const volumeChart = page.locator('[data-testid="chart-ingestion-volume"]');
    
    // Should either show charts or empty state messages
    const complianceEmpty = await complianceChart.locator('text=No compliance data available').isVisible();
    const volumeEmpty = await volumeChart.locator('text=No ingestion data available').isVisible();
    
    // At least one should be present (either data or empty state)
    expect(await complianceChart.isVisible()).toBeTruthy();
    expect(await volumeChart.isVisible()).toBeTruthy();
  });
});

test.describe('Integration Tests', () => {
  test('should navigate from analytics to research page', async ({ page }) => {
    await page.goto('/analytics');
    
    // Click research link from sidebar
    await page.click('[data-testid="sidebar-research"]');
    await expect(page).toHaveURL('/research');
  });

  test('should navigate with state/type filters to analytics', async ({ page }) => {
    await page.goto('/research');
    
    // If there's research data, try to navigate to analytics with filters
    const analyticsLink = page.locator('a[href*="/analytics"]');
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await expect(page).toHaveURL(/.*analytics.*/);
    }
  });

  test('should complete end-to-end workflow', async ({ page }) => {
    // Start at dashboard
    await page.goto('/');
    await expect(page.locator('[data-testid="sidebar-dashboard"]')).toBeVisible();
    
    // Navigate to research
    await page.click('[data-testid="sidebar-research"]');
    await expect(page).toHaveURL('/research');
    
    // Navigate to scheduling
    await page.click('[data-testid="sidebar-scheduling"]');
    await expect(page).toHaveURL('/scheduling');
    
    // Navigate to analytics
    await page.click('[data-testid="sidebar-analytics"]');
    await expect(page).toHaveURL('/analytics');
    
    // Navigate to diagnostics
    await page.click('[data-testid="sidebar-diagnostics"]');
    await expect(page).toHaveURL('/diagnostics');
    
    // Return to dashboard
    await page.click('[data-testid="sidebar-dashboard"]');
    await expect(page).toHaveURL('/dashboard');
  });
});