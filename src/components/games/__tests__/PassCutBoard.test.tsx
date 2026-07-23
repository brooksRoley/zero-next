// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import PassCutBoard from "src/components/games/PassCutBoard";
import { LEVELS } from "src/lib/games/passcut/levels";

const giveAndGo = LEVELS.find((l) => l.id === "give-and-go")!;

afterEach(() => cleanup());

describe("PassCutBoard (live interaction)", () => {
  it("fires onResult('offense') when the player secures a lane that connects the terminals", async () => {
    // give-and-go is offense-first with a direct PG-C lane: securing it links the
    // inbounder to the rim outright. This exercises the full DOM click ->
    // handleSecure -> graph.connected -> onResult path in a real render.
    const onResult = vi.fn();
    render(<PassCutBoard level={giveAndGo} onResult={onResult} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Secure pass lane PG to C" })
    );
    await waitFor(() => expect(onResult).toHaveBeenCalledWith("offense"));
  });

  it("lets the defense answer with a cut after a non-winning secure", async () => {
    const onResult = vi.fn();
    render(<PassCutBoard level={giveAndGo} onResult={onResult} />);
    const before = screen.getAllByRole("button", {
      name: /^Secure pass lane/,
    }).length;
    fireEvent.click(
      screen.getByRole("button", { name: "Secure pass lane PG to SG" })
    );
    // After our secure (one button removed) the solver-driven defense cuts a
    // lane (a second button removed) once its ~0.5s timer fires.
    await waitFor(
      () => {
        const now = screen.getAllByRole("button", {
          name: /^Secure pass lane/,
        }).length;
        expect(now).toBeLessThanOrEqual(before - 2);
      },
      { timeout: 2000 }
    );
    // One exchange doesn't decide this (offense-winnable) board.
    expect(onResult).not.toHaveBeenCalled();
  });
});
