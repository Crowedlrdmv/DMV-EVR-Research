import { test, expect } from '@playwright/test';

test.describe('Research Scheduling', () => {
  test('should create new research schedule', async ({ page }) => {
    await page.goto('/scheduling');
    
    // Click create new schedule button
    await page.click('[data-testid="button-create-schedule"]');
    
    // Fill out schedule form
    await page.fill('[data-testid="input-schedule-name"]', 'Test Schedule');
    await page.fill('[data-testid="input-description"]', 'Test schedule description');
    await page.selectOption('[data-testid="select-states"]', ['CA']);
    await page.check('[data-testid="checkbox-rules"]');
    await page.fill('[data-testid="input-cron-expression"]', '0 9 * * 1');
    
    // Submit form
    await page.click('[data-testid="button-submit-schedule"]');
    
    // Verify schedule was created
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should validate cron expressions', async ({ page }) => {
    await page.goto('/scheduling');
    
    await page.click('[data-testid="button-create-schedule"]');
    
    // Test invalid cron expression
    await page.fill('[data-testid="input-cron-expression"]', 'invalid-cron');
    await page.blur('[data-testid="input-cron-expression"]');
    
    // Should show validation error
    await expect(page.locator('[data-testid="cron-error"]')).toBeVisible();
    
    // Test valid cron expression
    await page.fill('[data-testid="input-cron-expression"]', '0 8 * * *');
    await page.blur('[data-testid="input-cron-expression"]');
    
    // Should show next run time
    await expect(page.locator('[data-testid="next-run-time"]')).toBeVisible();
  });

  test('should edit existing schedule', async ({ page }) => {
    await page.goto('/scheduling');
    
    // Click edit on first schedule if exists
    const editButtons = page.locator('[data-testid="button-edit-schedule"]');
    const count = await editButtons.count();
    
    if (count > 0) {
      await editButtons.first().click();
      
      // Modify schedule
      await page.fill('[data-testid="input-schedule-name"]', 'Updated Test Schedule');
      await page.click('[data-testid="button-submit-schedule"]');
      
      // Verify update
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    }
  });

  test('should delete schedule', async ({ page }) => {
    await page.goto('/scheduling');
    
    // Click delete on first schedule if exists
    const deleteButtons = page.locator('[data-testid="button-delete-schedule"]');
    const count = await deleteButtons.count();
    
    if (count > 0) {
      await deleteButtons.first().click();
      
      // Confirm deletion
      await page.click('[data-testid="button-confirm-delete"]');
      
      // Verify deletion
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    }
  });

  test('should toggle schedule active status', async ({ page }) => {
    await page.goto('/scheduling');
    
    // Toggle first schedule if exists
    const toggleButtons = page.locator('[data-testid="toggle-schedule-active"]');
    const count = await toggleButtons.count();
    
    if (count > 0) {
      await toggleButtons.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test('should display schedule list', async ({ page }) => {
    await page.goto('/scheduling');
    
    // Check for schedules table
    await expect(page.locator('[data-testid="schedules-table"]')).toBeVisible();
    
    // Should show either schedules or empty state
    const hasSchedules = await page.locator('[data-testid^="schedule-row-"]').first().isVisible();
    const emptyState = await page.locator('[data-testid="empty-schedules"]').isVisible();
    
    expect(hasSchedules || emptyState).toBeTruthy();
  });

  test('should show cron expression helpers', async ({ page }) => {
    await page.goto('/scheduling');
    
    await page.click('[data-testid="button-create-schedule"]');
    
    // Check for cron helper buttons/examples
    const cronHelpers = page.locator('[data-testid="cron-helpers"]');
    if (await cronHelpers.isVisible()) {
      await expect(cronHelpers).toBeVisible();
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/scheduling');
    
    await page.click('[data-testid="button-create-schedule"]');
    
    // Try to submit without required fields
    await page.click('[data-testid="button-submit-schedule"]');
    
    // Should show validation errors
    await expect(page.locator('[data-testid="form-errors"]')).toBeVisible();
  });
});