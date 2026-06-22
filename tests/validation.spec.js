import { test, expect } from '@playwright/test';

async function expectAlert(page, re) {
    await expect(page.locator('#alertModal')).toBeVisible();
    await expect(page.locator('#alertModalBody')).toContainText(re);
}

async function dismissAlert(page) {
    await page.locator('#alertModal .modal-footer .btn-primary').click();
    await expect(page.locator('#alertModal')).toBeHidden();
}

// Answer all six progressive questions (in order) to make the Next button appear.
// Does NOT fill fluid / temp / period — callers decide what to leave blank.
async function answerAllQuestions(page) {
    await page.locator('input[name="positiveIsoRisk"][value="yes"]').check();
    await page.locator('#qHotWork').waitFor({ state: 'visible' });
    await page.locator('input[name="hotWork"][value="no"]').check();
    await page.locator('#qCse').waitFor({ state: 'visible' });
    await page.locator('input[name="cse"][value="no"]').check();
    await page.locator('#qFlareVentDrains').waitFor({ state: 'visible' });
    await page.locator('input[name="flareVentDrains"][value="no"]').check();
    await page.locator('#qSbt').waitFor({ state: 'visible' });
    await page.locator('input[name="sbt"][value="no"]').check();
    await page.locator('#qBoundary').waitFor({ state: 'visible' });
    await page.locator('input[name="boundary"][value="no"]').check();
    await page.locator('#iccBlock').waitFor({ state: 'visible' });
    await page.locator('#nextBtn').waitFor({ state: 'visible' });
}

// Navigate to the tool, fill a title, answer both planning checks as No,
// wait for restBlock, then return so caller can set fields before clicking Next.
async function openRest(page, title = 'X') {
    await page.goto('/');
    await page.fill('#isoTitle', title);
    await page.locator('input[name="majorAccident"][value="no"]').check();
    await page.locator('input[name="waitShutdown"][value="no"]').check();
    await page.locator('#restBlock').waitFor({ state: 'visible' });
}

// ── Progressive reveal ─────────────────────────────────────────────────────────

test('Next is hidden until a title is entered', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gatingBlock')).toBeHidden();
    await expect(page.locator('#nextBtn')).toBeHidden();

    await page.fill('#isoTitle', 'Job');
    await expect(page.locator('#gatingBlock')).toBeVisible();
    await expect(page.locator('#nextBtn')).toBeHidden(); // still hidden — questions not answered
});

test('Next appears only after all six questions are answered', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');

    // Next is still hidden before any questions are answered
    await expect(page.locator('#nextBtn')).toBeHidden();

    // Answer questions one at a time, verifying Next is still hidden until the last one
    await page.locator('input[name="positiveIsoRisk"][value="yes"]').check();
    await page.locator('#qHotWork').waitFor({ state: 'visible' });
    await page.locator('input[name="hotWork"][value="no"]').check();
    await page.locator('#qCse').waitFor({ state: 'visible' });
    await page.locator('input[name="cse"][value="no"]').check();
    await page.locator('#qFlareVentDrains').waitFor({ state: 'visible' });
    await page.locator('input[name="flareVentDrains"][value="no"]').check();
    await page.locator('#qSbt').waitFor({ state: 'visible' });
    await page.locator('input[name="sbt"][value="no"]').check();
    await expect(page.locator('#nextBtn')).toBeHidden(); // still 5 of 6 done

    await page.locator('#qBoundary').waitFor({ state: 'visible' });
    await page.locator('input[name="boundary"][value="no"]').check();
    await page.locator('#nextBtn').waitFor({ state: 'visible' }); // now visible
});

test('questions are revealed one at a time', async ({ page }) => {
    await openRest(page);
    // Only Q1 is visible initially; Q2 through Q6 start hidden
    await expect(page.locator('#qHotWork')).toBeHidden();
    await expect(page.locator('#qCse')).toBeHidden();

    await page.locator('input[name="positiveIsoRisk"][value="yes"]').check();
    await page.locator('#qHotWork').waitFor({ state: 'visible' });
    await expect(page.locator('#qCse')).toBeHidden(); // Q3 still hidden

    await page.locator('input[name="hotWork"][value="no"]').check();
    await page.locator('#qCse').waitFor({ state: 'visible' });
});

// ── Stage 1 validation ─────────────────────────────────────────────────────────

test('missing fluid is rejected with a modal', async ({ page }) => {
    await openRest(page);
    // Leave fluid blank; fill everything else
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');
    await answerAllQuestions(page);
    await page.click('#nextBtn');
    await expectAlert(page, /complete.*highlighted/i);
    await expect(page.locator('#fluidSelect')).toHaveCSS('border-color', /rgb\(255,\s*0,\s*0\)/);
});

test('missing operating temperature is rejected', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    // Leave temp blank
    await page.selectOption('#period', 'oneOrLess');
    await answerAllQuestions(page);
    await page.click('#nextBtn');
    await expectAlert(page, /complete.*highlighted/i);
    await expect(page.locator('#operatingTemp')).toHaveCSS('border-color', /rgb\(255,\s*0,\s*0\)/);
});

test('missing duration is rejected', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await page.fill('#operatingTemp', '20');
    // Leave period blank
    await answerAllQuestions(page);
    await page.click('#nextBtn');
    await expectAlert(page, /complete.*highlighted/i);
    await expect(page.locator('#period')).toHaveCSS('border-color', /rgb\(255,\s*0,\s*0\)/);
});

test('"Other" fluid requires a name', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', 'other');
    // Leave other fluid name blank
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');
    await answerAllQuestions(page);
    await page.click('#nextBtn');
    await expectAlert(page, /complete.*highlighted/i);
    await expect(page.locator('#otherFluidName')).toHaveCSS('border-color', /rgb\(255,\s*0,\s*0\)/);
});

test('red borders are cleared when fields are corrected', async ({ page }) => {
    await openRest(page);
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');
    await answerAllQuestions(page);
    await page.click('#nextBtn');
    await dismissAlert(page);

    // Fluid select is red
    await expect(page.locator('#fluidSelect')).toHaveCSS('border-color', /rgb\(255,\s*0,\s*0\)/);
    // Correct it
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await expect(page.locator('#fluidSelect')).not.toHaveCSS('border-color', /rgb\(255,\s*0,\s*0\)/);
});

test('unanswered question row is highlighted red', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');
    // Answer Q1–Q5, leave Q6 (boundary) visible but unanswered
    await page.locator('input[name="positiveIsoRisk"][value="yes"]').check();
    await page.locator('#qHotWork').waitFor({ state: 'visible' });
    await page.locator('input[name="hotWork"][value="no"]').check();
    await page.locator('#qCse').waitFor({ state: 'visible' });
    await page.locator('input[name="cse"][value="no"]').check();
    await page.locator('#qFlareVentDrains').waitFor({ state: 'visible' });
    await page.locator('input[name="flareVentDrains"][value="no"]').check();
    await page.locator('#qSbt').waitFor({ state: 'visible' });
    await page.locator('input[name="sbt"][value="no"]').check();
    await page.locator('#qBoundary').waitFor({ state: 'visible' });
    // Boundary is visible but not answered — nextBtn is still hidden.
    // Use evaluate to call showSpec() directly, bypassing the hidden-button constraint.
    await page.evaluate(() => showSpec()); // showSpec is a global in the non-module script
    await dismissAlert(page);
    await expect(page.locator('#qBoundary')).toHaveClass(/q-error/);
});

// ── Stage 2 validation ─────────────────────────────────────────────────────────

test('stage 2 requires line description', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');
    await answerAllQuestions(page);
    await page.click('#nextBtn');
    await page.locator('#calcBtn').waitFor({ state: 'visible' });

    // No line description — Calculate should reject
    await page.click('#calcBtn');
    await expectAlert(page, /complete.*highlighted/i);
    await expect(page.locator('#lineDesc')).toHaveCSS('border-color', /rgb\(255,\s*0,\s*0\)/);
    await expect(page.locator('#outCard')).toBeHidden();
});

test('stage 2 requires isolation selection when picker is visible', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');
    await answerAllQuestions(page);
    await page.click('#nextBtn');
    await page.locator('#calcBtn').waitFor({ state: 'visible' });

    // Fill description but no isolation selected
    await page.fill('#lineDesc', 'Test line');
    await page.click('#calcBtn');
    await expectAlert(page, /complete.*highlighted/i);
    await expect(page.locator('#isoTypeSection')).toHaveClass(/section-error/);
    await expect(page.locator('#outCard')).toBeHidden();
});

test('section-error class is cleared when isolation is selected', async ({ page }) => {
    await openRest(page);
    await page.selectOption('#fluidSelect', { label: 'Diesel' });
    await page.fill('#operatingTemp', '20');
    await page.selectOption('#period', 'oneOrLess');
    await answerAllQuestions(page);
    await page.click('#nextBtn');
    await page.locator('#calcBtn').waitFor({ state: 'visible' });

    await page.fill('#lineDesc', 'Test line');
    await page.click('#calcBtn');
    await dismissAlert(page);
    await expect(page.locator('#isoTypeSection')).toHaveClass(/section-error/);

    await page.locator('label[for="dbb"]').click();
    await expect(page.locator('#isoTypeSection')).not.toHaveClass(/section-error/);
});
