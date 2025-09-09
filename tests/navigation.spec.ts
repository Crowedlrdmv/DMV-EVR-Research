import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to all main pages', async ({ page }) => {
    await page.goto('/');
    
    // Test dashboard navigation
    await expect(page.locator('[data-testid="sidebar-dashboard"]')).toBeVisible();
    await page.click('[data-testid="sidebar-dashboard"]');
    await expect(page).toHaveURL('/dashboard');
    
    // Test analytics navigation
    await page.click('[data-testid="sidebar-analytics"]');
    await expect(page).toHaveURL('/analytics');
    await expect(page.locator('[data-testid="analytics-title"]')).toContainText('Analytics Dashboard');
    
    // Test research navigation
    await page.click('[data-testid="sidebar-research"]');
    await expect(page).toHaveURL('/research');
    
    // Test scheduling navigation
    await page.click('[data-testid="sidebar-scheduling"]');
    await expect(page).toHaveURL('/scheduling');
    
    // Test diagnostics navigation
    await page.click('[data-testid="sidebar-diagnostics"]');
    await expect(page).toHaveURL('/diagnostics');
  });

  test('should display system status in sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Check database status indicators
    await expect(page.locator('[data-testid="prisma-status"]')).toContainText('Connected');
    await expect(page.locator('[data-testid="knex-status"]')).toContainText('Connected');
    await expect(page.locator('[data-testid="record-count"]')).toBeVisible();
  });

  test('should have working app header', async ({ page }) => {
    await page.goto('/');
    
    // Check app header elements
    await expect(page.locator('[data-testid="app-title"]')).toContainText('DMV Compliance Research');
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
  });
});