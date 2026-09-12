import { describe, expect, it, vi } from "vitest";
import { authenticate } from "@/lib/api/auth";

describe("authenticate", () => {
  it("passes a bearer token to the client and validates it", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    const factory = vi.fn().mockResolvedValue({ auth: { getUser } });
    const result = await authenticate(new Request("http://localhost", { headers: { Authorization: "Bearer token" } }), factory as never);
    expect(factory).toHaveBeenCalledWith(expect.any(Request), "token"); expect(getUser).toHaveBeenCalledWith("token"); expect(result.user.id).toBe("user");
  });
  it("rejects missing users", async () => {
    const factory = vi.fn().mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } });
    await expect(authenticate(new Request("http://localhost"), factory as never)).rejects.toMatchObject({ status: 401, code: "unauthorized" });
  });
});
