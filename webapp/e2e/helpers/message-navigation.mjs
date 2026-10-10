import { expect } from '@playwright/test';
export async function openFirstMessageThread(page) {
  if(page.viewportSize()?.width<768 && !new URL(page.url()).searchParams.has('athlete_id')) {
    const conversation=page.getByRole('button',{name:/^Open conversation with/}).first();
    await expect(conversation).toBeVisible();await conversation.click();
  }
}
