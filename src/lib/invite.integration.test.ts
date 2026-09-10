import { describe, it, expect } from "vitest";
import { inviteContext } from "@/lib/invite";
import { prisma } from "@/lib/prisma";
import { makeUser, makeGroup } from "@/test/factories";

async function makeInvite(overrides?: { expiresAt?: Date; revokedAt?: Date }) {
  const owner = await makeUser({ name: " Owner Ana ".trim() });
  const group = await makeGroup(owner.user.id, { name: "Trip to Cluj" });
  const invite = await prisma.groupInvite.create({
    data: {
      groupId: group.id,
      createdById: owner.user.id,
      expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 86_400_000),
      revokedAt: overrides?.revokedAt ?? null,
    },
  });
  return { owner, group, invite };
}

describe("inviteContext", () => {
  it("returns the group and inviter for a valid invite path", async () => {
    const { owner, group, invite } = await makeInvite();

    expect(await inviteContext(`/invite/${invite.token}`)).toEqual({
      groupName: group.name,
      inviterName: owner.user.name,
    });
  });

  it("returns null for a non-invite next path", async () => {
    expect(await inviteContext("/groups/abc123")).toBeNull();
  });

  it("returns null for a missing or empty next", async () => {
    expect(await inviteContext(undefined)).toBeNull();
    expect(await inviteContext("")).toBeNull();
  });

  it("returns null when the token has no matching invite", async () => {
    expect(await inviteContext("/invite/does-not-exist")).toBeNull();
  });

  it("returns null for an expired invite", async () => {
    const { invite } = await makeInvite({ expiresAt: new Date(Date.now() - 1000) });
    expect(await inviteContext(`/invite/${invite.token}`)).toBeNull();
  });

  it("returns null for a revoked invite", async () => {
    const { invite } = await makeInvite({ revokedAt: new Date() });
    expect(await inviteContext(`/invite/${invite.token}`)).toBeNull();
  });

  it("does not match a path with a trailing segment or query", async () => {
    const { invite } = await makeInvite();
    expect(await inviteContext(`/invite/${invite.token}/extra`)).toBeNull();
    expect(await inviteContext(`/invite/${invite.token}?x=1`)).toBeNull();
  });
});
