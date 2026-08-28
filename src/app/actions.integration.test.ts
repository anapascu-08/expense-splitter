import { describe, it, expect } from "vitest";
import {
  createGroup,
  updateGroup,
  addExpense,
  acceptInvite,
} from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { makeUser, makeGroup, addMember, signIn, formData } from "@/test/factories";
import { catchRedirect, expectNotFound } from "@/test/next-navigation-errors";

describe("createGroup", () => {
  it("creates the group with the caller as owner member and redirects to it", async () => {
    const { user } = await makeUser();
    await signIn(user.id);

    const url = await catchRedirect(createGroup(formData({ name: "Trip" })));
    const id = url.replace("/groups/", "");

    const group = await prisma.group.findUnique({
      where: { id },
      include: { groupMembers: true },
    });
    expect(group?.ownerId).toBe(user.id);
    expect(group?.groupMembers).toEqual([
      expect.objectContaining({ userId: user.id, role: "owner" }),
    ]);
  });
});

describe("updateGroup", () => {
  it("is a no-op for a non-owner member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id, { name: "Original" });
    const member = await makeUser();
    await addMember(group.id, member.user.id);
    await signIn(member.user.id);

    await updateGroup(group.id, formData({ name: "Hijacked" }));

    const after = await prisma.group.findUnique({ where: { id: group.id } });
    expect(after?.name).toBe("Original");
  });

  it("renames the group for the owner and redirects", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id, { name: "Original" });
    await signIn(owner.user.id);

    const url = await catchRedirect(
      updateGroup(group.id, formData({ name: "Renamed" }))
    );
    expect(url).toBe(`/groups/${group.id}`);
    const after = await prisma.group.findUnique({ where: { id: group.id } });
    expect(after?.name).toBe("Renamed");
  });
});

describe("addExpense", () => {
  it("404s when the caller is not a group member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const outsider = await makeUser();
    await signIn(outsider.user.id);

    await expectNotFound(
      addExpense(group.id, formData({ description: "x", amount: "10" }))
    );
    expect(await prisma.expense.count()).toBe(0);
  });

  it("creates an expense with participants for a member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const alice = await prisma.member.create({
      data: { groupId: group.id, name: "Alice" },
    });

    await addExpense(
      group.id,
      formData({
        description: "Lunch",
        amount: "100",
        paidById: alice.id,
        splitMode: "EQUAL",
        participantIds: [alice.id],
      })
    );

    const expense = await prisma.expense.findFirst({
      where: { groupId: group.id },
      include: { participants: true },
    });
    expect(expense?.description).toBe("Lunch");
    expect(expense?.amount).toBe(10000);
    expect(expense?.participants).toHaveLength(1);
  });
});

describe("acceptInvite", () => {
  async function makeInvite(overrides?: {
    expiresAt?: Date;
    revokedAt?: Date | null;
  }) {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const invite = await prisma.groupInvite.create({
      data: {
        groupId: group.id,
        createdById: owner.user.id,
        expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 86_400_000),
        revokedAt: overrides?.revokedAt ?? null,
      },
    });
    return { group, invite };
  }

  it("adds the caller as a member and redirects to the group", async () => {
    const { group, invite } = await makeInvite();
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    const url = await catchRedirect(acceptInvite(invite.token));
    expect(url).toBe(`/groups/${group.id}`);

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: joiner.user.id } },
    });
    expect(membership?.role).toBe("member");
  });

  it("does nothing for an expired invite", async () => {
    const { group, invite } = await makeInvite({
      expiresAt: new Date(Date.now() - 1000),
    });
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    await acceptInvite(invite.token); // no redirect thrown
    expect(
      await prisma.groupMember.count({
        where: { groupId: group.id, userId: joiner.user.id },
      })
    ).toBe(0);
  });

  it("does nothing for a revoked invite", async () => {
    const { group, invite } = await makeInvite({ revokedAt: new Date() });
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    await acceptInvite(invite.token);
    expect(
      await prisma.groupMember.count({
        where: { groupId: group.id, userId: joiner.user.id },
      })
    ).toBe(0);
  });
});
