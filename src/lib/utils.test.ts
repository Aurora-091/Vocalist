import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("should merge tailwind classes correctly", () => {
    expect(cn("p-4 text-red-500", "text-blue-500")).toBe("p-4 text-blue-500");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    const isHidden = false;
    expect(cn("p-4", isActive && "m-4", isHidden && "text-red-500")).toBe("p-4 m-4");
  });

  it("should handle arrays of classes", () => {
    expect(cn(["p-4", "m-4"], "text-red-500")).toBe("p-4 m-4 text-red-500");
  });
});
