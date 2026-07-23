// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ReadReactBoard from "src/components/games/ReadReactBoard";
import { LEVELS } from "src/lib/games/readreact/levels";

const pickYourPoison = LEVELS.find((l) => l.id === "pick-your-poison")!;

afterEach(() => cleanup());

describe("ReadReactBoard (adaptive defense)", () => {
  const paintButton = () =>
    screen.getByRole("button", { name: /Attack the Paint/ });

  it("keys on a spammed play: the defense shifts to counter repeated paint attacks", () => {
    render(<ReadReactBoard level={pickYourPoison} onComplete={vi.fn()} />);
    const feedback = () => screen.getByTestId("last-feedback");

    // Possession 1: with no history, the defense best-responds to a uniform
    // offense — it chases shooters, NOT packing the paint.
    fireEvent.click(paintButton());
    expect(feedback().textContent).toMatch(/Chase Shooters/);

    // Possession 2: one revealed paint attempt is enough to flip the read — the
    // defense now packs the paint to counter the tendency.
    fireEvent.click(paintButton());
    expect(feedback().textContent).toMatch(/Pack the Paint/);
  });

  it("fires onComplete once, after the full possession series", () => {
    const onComplete = vi.fn();
    render(<ReadReactBoard level={pickYourPoison} onComplete={onComplete} />);
    for (let k = 0; k < pickYourPoison.possessions; k++) {
      fireEvent.click(paintButton());
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
    const arg = onComplete.mock.calls[0][0];
    expect(arg.possessions).toBe(pickYourPoison.possessions);
    expect(typeof arg.points).toBe("number");
    expect(typeof arg.benchmark).toBe("number");
  });
});
