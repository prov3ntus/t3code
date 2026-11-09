import { expect, it } from "vite-plus/test";
import { QuitGuard } from "./QuitGuard.ts";

it("leaves idle exits immediate, shares a prompt, and guards again after cancel", async () => {
  const guard = new QuitGuard();
  expect(guard.canExit).toBe(true);
  guard.count = 2;
  let answer!: (confirmed: boolean) => void;
  let prompts = 0;
  const prompt = (count: number) => {
    expect(count).toBe(2);
    prompts++;
    return new Promise<boolean>((resolve) => {
      answer = resolve;
    });
  };
  const first = guard.confirm(prompt);
  expect(guard.confirm(prompt)).toBe(first);
  answer(false);
  expect(await first).toBe(false);
  expect(guard.canExit).toBe(false);
  const second = guard.confirm(prompt);
  answer(true);
  expect(await second).toBe(true);
  expect(guard.canExit).toBe(true);
  expect(await guard.confirm(prompt)).toBe(true);
  expect(prompts).toBe(2);
});
