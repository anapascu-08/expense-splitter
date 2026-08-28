import { describe, it, expect } from "vitest";
import { requireGroupAccess } from "@/lib/access";
import { makeUser, makeGroup, addMember, signIn } from "@/test/factories";
import { catchRedirect, expectNotFound } from "@/test/next-navigation-errors";

describe("requireGroupAccess", () => {
  it("redirects to /login when there is no session", async () => {
    const { user } = await makeUser();
    const group = await makeGroup(user.id);
    // not signed in
    expect(await catchRedirect(requireGroupAccess(group.id))).toBe("/login");
  });

  it("404s when the user is signed in but not a member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const outsider = await makeUser();
    await signIn(outsider.user.id);
    await expectNotFound(requireGroupAccess(group.id));
  });

  it("returns role 'member' for a plain member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const member = await makeUser();
    await addMember(group.id, member.user.id);
    await signIn(member.user.id);

    const access = await requireGroupAccess(group.id);
    expect(access.role).toBe("member");
    expect(access.user.id).toBe(member.user.id);
  });

  it("returns role 'owner' for the group owner", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);

    const access = await requireGroupAccess(group.id);
    expect(access.role).toBe("owner");
  });
});
